import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
// supertest est un export CommonJS : l'import par défaut n'est pas une fonction ici.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import request = require('supertest');
import { Organisation, TenantConnectionService } from '@app/database';
import { hasherPinParent } from '@app/common';
import { ParentPortalController } from './parent-portal.controller';
import { ParentPortalService } from './parent-portal.service';
import { ParentPinLockoutService } from './parent-pin-lockout.service';
import { FcmService } from './fcm.service';
import {
  cleIdentifiantDepuisRequete,
  extraireIpClient,
} from './parent-auth.config';

const SECRET = 'smartbus-test-jwt-secret-32chars-min';
const ECOLE = 'ECOLE1';
const EMAIL = 'parent@ecole.ci';
const PIN = '1234';
const PIN_FAUX = '9999';

interface JournalSql {
  sql: string;
  params: unknown[];
}

interface CorpsHttp {
  message?: string | string[];
  code?: string;
  token?: string;
  schoolCode?: string;
}

interface JetonParent {
  role: string;
  sub: string;
  organisationId: string;
  exp: number;
  iat: number;
}

function lireCorps(reponse: { body: unknown }): CorpsHttp {
  return reponse.body as CorpsHttp;
}

function messageDe(reponse: { body: unknown }): string {
  const message = lireCorps(reponse).message;
  if (Array.isArray(message)) return message.join(' ');
  return message ?? '';
}

function configDe(valeurs: Record<string, string>): ConfigService {
  return {
    get: (cle: string, defaut?: unknown) =>
      cle in valeurs ? valeurs[cle] : defaut,
  } as unknown as ConfigService;
}

async function monterApplication(options: {
  config: Record<string, string>;
  limiteIdentifiant: number;
  limiteIp: number;
}) {
  const journal: JournalSql[] = [];
  const stockage: { pinCode: string; ecoleTrouvee: boolean } = {
    pinCode: '',
    ecoleTrouvee: true,
  };
  const org = {
    id: 'org-1',
    name: 'École Démo',
    code: ECOLE,
    dbProvisioned: true,
  };
  const findEcoles = jest.fn(() => {
    throw new Error('balayage de toutes les écoles interdit');
  });

  const moduleRef = await Test.createTestingModule({
    imports: [
      JwtModule.register({ secret: SECRET, signOptions: { expiresIn: '1h' } }),
      ThrottlerModule.forRoot({
        errorMessage: 'Trop de requêtes sur la connexion parent.',
        throttlers: [
          {
            name: 'parentIdentifiant',
            ttl: 60_000,
            limit: options.limiteIdentifiant,
            getTracker: (req) => cleIdentifiantDepuisRequete(req),
          },
          {
            name: 'parentIp',
            ttl: 60_000,
            limit: options.limiteIp,
            getTracker: (req) => extraireIpClient(req),
          },
        ],
      }),
    ],
    controllers: [ParentPortalController],
    providers: [
      ParentPortalService,
      ParentPinLockoutService,
      { provide: ConfigService, useValue: configDe(options.config) },
      { provide: FcmService, useValue: { estConfigure: () => false } },
      {
        provide: getRepositoryToken(Organisation),
        useValue: {
          find: findEcoles,
          findOne: jest.fn(
            (critere: { where?: { code?: string; id?: string } }) => {
              if (!stockage.ecoleTrouvee) return null;
              const where = critere?.where ?? {};
              if (where.code === ECOLE || where.id === org.id) return org;
              return null;
            },
          ),
        },
      },
      {
        provide: TenantConnectionService,
        useValue: {
          getTenantConnection: jest.fn(() => ({
            query: jest.fn((sql: string, params: unknown[] = []) => {
              journal.push({ sql, params });
              if (/UPDATE\s+parents/i.test(sql)) return [];
              if (/WHERE id/i.test(sql)) return [{ pinCode: stockage.pinCode }];
              const brut = params[0];
              const identite = typeof brut === 'string' ? brut : '';
              if (identite === EMAIL || identite === '+22501020304') {
                return [
                  {
                    id: 'parent-1',
                    firstName: 'Awa',
                    lastName: 'Koné',
                    email: EMAIL,
                    phone: '+22501020304',
                    pinCode: stockage.pinCode,
                    notifPunchEnabled: true,
                    notifProximityEnabled: false,
                  },
                ];
              }
              return [];
            }),
          })),
        },
      },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();

  return { app, journal, stockage, findEcoles, moduleRef };
}

describe('POST /api/v1/auth/parent/login (supertest)', () => {
  describe('refus', () => {
    let app: INestApplication;
    let journal: JournalSql[];
    let stockage: { pinCode: string; ecoleTrouvee: boolean };
    let findEcoles: jest.Mock;
    let hashPin: string;

    beforeAll(async () => {
      hashPin = await hasherPinParent(PIN);
      const monte = await monterApplication({
        config: {
          JWT_SECRET: SECRET,
          PARENT_JWT_EXPIRES_IN: '15m',
          PARENT_PIN_MAX_ATTEMPTS: '3',
          PARENT_PIN_LOCK_STEPS_SEC: '60,300',
        },
        limiteIdentifiant: 100,
        limiteIp: 100,
      });
      app = monte.app;
      journal = monte.journal;
      stockage = monte.stockage;
      findEcoles = monte.findEcoles;
      stockage.pinCode = hashPin;
    });

    afterAll(async () => {
      await app.close();
    });

    const connexion = (corps: Record<string, unknown>) =>
      request(app.getHttpServer())
        .post('/api/v1/auth/parent/login')
        .send(corps);

    it('refuse une connexion sans école', async () => {
      const reponse = await connexion({ emailOrPhone: EMAIL, pinCode: PIN });

      expect(reponse.status).toBe(400);
      expect(messageDe(reponse)).toMatch(/établissement/i);
      expect(findEcoles).not.toHaveBeenCalled();
      expect(journal).toHaveLength(0);
    });

    it('refuse un PIN incorrect', async () => {
      stockage.pinCode = hashPin;
      const avant = journal.length;

      const reponse = await connexion({
        emailOrPhone: EMAIL,
        pinCode: PIN_FAUX,
        schoolCode: ECOLE,
      });

      expect(reponse.status).toBe(401);
      expect(messageDe(reponse)).toMatch(/incorrect/i);
      expect(journal.length).toBe(avant + 1);
      expect(findEcoles).not.toHaveBeenCalled();
    });

    it('refuse un PIN encore stocké en clair', async () => {
      stockage.pinCode = PIN;

      const reponse = await connexion({
        emailOrPhone: EMAIL,
        pinCode: PIN,
        schoolCode: ECOLE,
      });

      expect(reponse.status).toBe(401);
      stockage.pinCode = hashPin;
    });

    it('verrouille l’identifiant après N essais, y compris avec le bon PIN', async () => {
      const email = 'force@ecole.ci';
      const avant = journal.length;

      const premier = await connexion({
        emailOrPhone: email,
        pinCode: PIN_FAUX,
        schoolCode: ECOLE,
      });
      const deuxieme = await connexion({
        emailOrPhone: email,
        pinCode: PIN_FAUX,
        schoolCode: ECOLE,
      });
      const troisieme = await connexion({
        emailOrPhone: email,
        pinCode: PIN_FAUX,
        schoolCode: ECOLE,
      });

      expect(premier.status).toBe(401);
      expect(deuxieme.status).toBe(401);
      expect(troisieme.status).toBe(429);
      expect(lireCorps(troisieme).code).toBe('PARENT_PIN_LOCKED');

      const apresEchecs = journal.length;
      expect(apresEchecs).toBe(avant + 3);

      const bonPin = await connexion({
        emailOrPhone: email,
        pinCode: PIN,
        schoolCode: ECOLE,
      });
      expect(bonPin.status).toBe(429);
      expect(lireCorps(bonPin).code).toBe('PARENT_PIN_LOCKED');
      expect(journal.length).toBe(apresEchecs);
      expect(findEcoles).not.toHaveBeenCalled();
    });

    it('connecte avec le hash et un jeton court, sans PIN dans la réponse', async () => {
      stockage.pinCode = hashPin;
      const reponse = await connexion({
        emailOrPhone: EMAIL,
        pinCode: PIN,
        schoolCode: ECOLE,
      });

      expect(reponse.status).toBe(200);
      const jeton = lireCorps(reponse).token ?? '';
      expect(jeton).toEqual(expect.any(String));
      expect(JSON.stringify(lireCorps(reponse))).not.toContain(PIN);
      expect(JSON.stringify(lireCorps(reponse))).not.toContain(hashPin);
      expect(lireCorps(reponse).schoolCode).toBe(ECOLE);

      const jwt = app.get(JwtService);
      const payload: JetonParent = await jwt.verifyAsync(jeton, {
        secret: SECRET,
      });
      expect(payload.role).toBe('PARENT');
      expect(payload.sub).toBe('parent-1');
      expect(payload.organisationId).toBe('org-1');
      expect(payload.exp - payload.iat).toBe(15 * 60);
      expect(findEcoles).not.toHaveBeenCalled();
    });

    it("n'écrit pas le PIN en clair lors d'un changement", async () => {
      stockage.pinCode = hashPin;
      const jwt = app.get(JwtService);
      const token = jwt.sign({
        sub: 'parent-1',
        email: EMAIL,
        role: 'PARENT',
        organisationId: 'org-1',
      });

      const reponse = await request(app.getHttpServer())
        .patch('/api/v1/parent/me/pin')
        .set('Authorization', `Bearer ${token}`)
        .send({ ancienPin: PIN, nouveauPin: '5678' });

      expect(reponse.status).toBe(200);
      const update = journal.find((entree) =>
        /UPDATE\s+parents/i.test(entree.sql),
      );
      expect(update).toBeDefined();
      const valeurStockee = update?.params[0];
      const stocke = typeof valeurStockee === 'string' ? valeurStockee : '';
      expect(stocke).not.toBe('5678');
      expect(stocke.startsWith('$2b$12$')).toBe(true);
      const bcrypt = await import('bcrypt');
      expect(await bcrypt.compare('5678', stocke)).toBe(true);
      expect(await bcrypt.compare(PIN, stocke)).toBe(false);
    });
  });

  describe('limite de débit', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const monte = await monterApplication({
        config: {
          JWT_SECRET: SECRET,
          PARENT_JWT_EXPIRES_IN: '15m',
          PARENT_PIN_MAX_ATTEMPTS: '100',
          PARENT_PIN_LOCK_STEPS_SEC: '60',
        },
        limiteIdentifiant: 2,
        limiteIp: 100,
      });
      app = monte.app;
      monte.stockage.pinCode = await hasherPinParent(PIN);
    });

    afterAll(async () => {
      await app.close();
    });

    it("plafond par identifiant avant même d'atteindre le verrouillage", async () => {
      const corps = {
        emailOrPhone: 'debit@ecole.ci',
        pinCode: PIN_FAUX,
        schoolCode: ECOLE,
      };
      const poster = () =>
        request(app.getHttpServer())
          .post('/api/v1/auth/parent/login')
          .send(corps);

      expect((await poster()).status).toBe(401);
      expect((await poster()).status).toBe(401);
      const bloque = await poster();

      expect(bloque.status).toBe(429);
      expect(lireCorps(bloque).code).toBeUndefined();
      expect(messageDe(bloque)).toMatch(/Trop de requêtes/);
    });
  });
});
