import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DirectorInvitationService } from '@app/common';
import { Subscription, User, UserRole, UserStatus } from '@app/database';
import * as crypto from 'crypto';
import request = require('supertest');
import { OrganisationsService } from '../organisations/organisations.service';
import { ProvisioningService } from '../provisioning/provisioning.service';
import { AuthController } from './auth.controller';
import { AuthService, REFRESH_TOKEN_TYPE } from './auth.service';

const ACCES = 'a'.repeat(64);
const REFRESH = 'b'.repeat(64);
const AUTRE_CLE = 'c'.repeat(64);
const USER_ID = '11111111-1111-4111-8111-111111111111';
const AUTRE_ID = '22222222-2222-4222-8222-222222222222';

interface UtilisateurStocke {
  id: string;
  email: string;
  role: UserRole;
  organisationId: string | null;
  refreshToken: string | null;
  status: UserStatus;
}

function empreinte(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function jetonSansSignature(payload: object): string {
  const entete = Buffer.from(
    JSON.stringify({ alg: 'none', typ: 'JWT' }),
  ).toString('base64url');
  const corps = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${entete}.${corps}.`;
}

/**
 * TD-001 — le refresh token est vérifié (signature, expiration, type) et
 * l'identifiant vient du jeton, pas du corps. Ces cas prouvent le refus.
 */
describe('POST /auth/refresh', () => {
  let app: INestApplication;
  let service: AuthService;
  let jwt: JwtService;
  const utilisateurs = new Map<string, UtilisateurStocke>();

  const userRepository = {
    findOne: jest.fn(async ({ where }: { where: { id?: string } }) => {
      if (!where?.id) return null;
      const trouve = utilisateurs.get(where.id);
      return trouve ? { ...trouve } : null;
    }),
    update: jest.fn(
      async (
        critere: string | { id: string; refreshToken?: string },
        patch: Partial<UtilisateurStocke>,
      ) => {
        const id = typeof critere === 'string' ? critere : critere.id;
        const trouve = utilisateurs.get(id);
        if (!trouve) return { affected: 0 };
        if (
          typeof critere !== 'string' &&
          critere.refreshToken !== undefined &&
          trouve.refreshToken !== critere.refreshToken
        ) {
          return { affected: 0 };
        }
        Object.assign(trouve, patch);
        return { affected: 1 };
      },
    ),
  };

  const configService = {
    get: (cle: string, defaut?: string) => {
      const valeurs: Record<string, string> = {
        JWT_SECRET: ACCES,
        JWT_REFRESH_SECRET: REFRESH,
        JWT_EXPIRES_IN: '15m',
        JWT_REFRESH_EXPIRES_IN: '7d',
      };
      return valeurs[cle] ?? defaut;
    },
  };

  function semer(id = USER_ID): UtilisateurStocke {
    const user: UtilisateurStocke = {
      id,
      email: id === USER_ID ? 'admin@smartbus.ci' : 'autre@smartbus.ci',
      role: UserRole.SUPER_ADMIN,
      organisationId: null,
      refreshToken: null,
      status: UserStatus.ACTIVE,
    };
    utilisateurs.set(id, user);
    return user;
  }

  beforeAll(async () => {
    jwt = new JwtService();
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(Subscription), useValue: {} },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: configService },
        { provide: OrganisationsService, useValue: { findOne: jest.fn() } },
        { provide: ProvisioningService, useValue: {} },
        { provide: DirectorInvitationService, useValue: {} },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    service = moduleRef.get(AuthService);
  });

  afterAll(async () => {
    await app.close();
  });

  const majInitiale = userRepository.update.getMockImplementation();

  beforeEach(() => {
    utilisateurs.clear();
    userRepository.findOne.mockClear();
    userRepository.update.mockClear();
    if (majInitiale) userRepository.update.mockImplementation(majInitiale);
  });

  async function session(): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const user = semer();
    const { tokens } = await service.login(user as unknown as User);
    return tokens;
  }

  it('renouvelle la session et stocke une empreinte SHA-256 du nouveau jeton', async () => {
    const tokens = await session();

    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: tokens.refreshToken })
      .expect(200);

    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).not.toBe(tokens.refreshToken);

    const stockee = utilisateurs.get(USER_ID)?.refreshToken;
    expect(stockee).toBe(empreinte(res.body.refreshToken));
    expect(stockee).toHaveLength(64);
    expect(stockee?.startsWith('$2')).toBe(false);
    expect(userRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: USER_ID } }),
    );
  });

  it("refuse un jeton forgé, même lorsque l'empreinte stockée correspond", async () => {
    const user = semer();
    const { refreshToken } = (await service.login(user as unknown as User))
      .tokens;
    const [entete, corps] = refreshToken.split('.');
    const forge = `${entete}.${corps}.signature-forgee`;
    utilisateurs.get(USER_ID)!.refreshToken = empreinte(forge);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: forge })
      .expect(401);

    const sansSignature = jetonSansSignature({
      sub: USER_ID,
      email: user.email,
      role: user.role,
      type: REFRESH_TOKEN_TYPE,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    utilisateurs.get(USER_ID)!.refreshToken = empreinte(sansSignature);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: sansSignature })
      .expect(401);

    const signeAvecLeRepli = await jwt.signAsync(
      {
        sub: USER_ID,
        email: user.email,
        role: user.role,
        type: REFRESH_TOKEN_TYPE,
      },
      { secret: 'secret', expiresIn: '1h' },
    );
    utilisateurs.get(USER_ID)!.refreshToken = empreinte(signeAvecLeRepli);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: signeAvecLeRepli })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'pas-un-jeton' })
      .expect(401);
  });

  it('refuse un jeton signé avec une autre clé, même si son empreinte est en base', async () => {
    semer();
    const token = await jwt.signAsync(
      {
        sub: USER_ID,
        email: 'admin@smartbus.ci',
        role: UserRole.SUPER_ADMIN,
        type: REFRESH_TOKEN_TYPE,
      },
      { secret: AUTRE_CLE, expiresIn: '1h' },
    );
    utilisateurs.get(USER_ID)!.refreshToken = empreinte(token);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: token })
      .expect(401);

    expect(utilisateurs.get(USER_ID)?.refreshToken).toBe(empreinte(token));
  });

  it('refuse un jeton rejoué après rotation et accepte le nouveau', async () => {
    const tokens = await session();

    const premier = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: tokens.refreshToken })
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: tokens.refreshToken })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: premier.body.refreshToken })
      .expect(200);
  });

  it('refuse un jeton expiré', async () => {
    semer();
    const expire = await jwt.signAsync(
      {
        sub: USER_ID,
        email: 'admin@smartbus.ci',
        role: UserRole.SUPER_ADMIN,
        type: REFRESH_TOKEN_TYPE,
        exp: Math.floor(Date.now() / 1000) - 30,
      },
      { secret: REFRESH },
    );

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: expire })
      .expect(401);
  });

  it("refuse un jeton qui n'est pas de type refresh, même signé avec la clé de rafraîchissement", async () => {
    semer();
    const acces = await jwt.signAsync(
      { sub: USER_ID, email: 'admin@smartbus.ci', role: UserRole.SUPER_ADMIN },
      { secret: REFRESH, expiresIn: '1h' },
    );
    utilisateurs.get(USER_ID)!.refreshToken = empreinte(acces);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: acces })
      .expect(401);
  });

  it("lit l'identifiant dans le jeton vérifié et ignore un autre compte", async () => {
    semer(AUTRE_ID);
    const token = await jwt.signAsync(
      {
        sub: USER_ID,
        email: 'admin@smartbus.ci',
        role: UserRole.SUPER_ADMIN,
        type: REFRESH_TOKEN_TYPE,
      },
      { secret: REFRESH, expiresIn: '1h' },
    );

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: token })
      .expect(401);

    expect(userRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: USER_ID } }),
    );
    expect(utilisateurs.has(AUTRE_ID)).toBe(true);
    expect(utilisateurs.get(AUTRE_ID)?.refreshToken).toBeNull();
  });

  it('rejette userId dans le corps (le contrat ne le prévoit plus)', async () => {
    const tokens = await session();

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ userId: AUTRE_ID, refreshToken: tokens.refreshToken })
      .expect(400);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: tokens.refreshToken })
      .expect(200);
  });

  it('rejette un corps sans refresh token', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({})
      .expect(400);
  });

  it("refuse la rotation si l'empreinte a déjà changé, sans brûler le jeton", async () => {
    const tokens = await session();
    const original = userRepository.update.getMockImplementation();
    userRepository.update.mockImplementation(async (critere, patch) => {
      if (typeof critere !== 'string') return { affected: 0 };
      return original!(critere, patch);
    });

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: tokens.refreshToken })
      .expect(401);

    expect(utilisateurs.get(USER_ID)?.refreshToken).toBe(
      empreinte(tokens.refreshToken),
    );
  });
});
