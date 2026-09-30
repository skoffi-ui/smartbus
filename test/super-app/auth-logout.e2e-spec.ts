import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DirectorInvitationService } from '../../libs/common/src/invitations/director-invitation.service';
import { Subscription, User, UserRole, UserStatus } from '@app/database';
import * as bcrypt from 'bcrypt';
import request = require('supertest');
import { AuthController } from '../../apps/super-app/src/modules/auth/auth.controller';
import { AuthService } from '../../apps/super-app/src/modules/auth/auth.service';
import { LocalStrategy } from '../../apps/super-app/src/modules/auth/strategies/local.strategy';
import { JwtStrategy } from '../../apps/super-app/src/modules/auth/strategies/jwt.strategy';
import { OrganisationsService } from '../../apps/super-app/src/modules/organisations/organisations.service';
import { ProvisioningService } from '../../apps/super-app/src/modules/provisioning/provisioning.service';

const ACCES = 'a'.repeat(64);
const REFRESH = 'b'.repeat(64);
const USER_ID = '11111111-1111-4111-8111-111111111111';

/**
 * Déconnexion réelle : JwtStrategy renvoie l'entité User (`id`, pas `sub`).
 * Logout doit répondre 200 et révoquer le refresh token (401 ensuite).
 *
 * Ne démarre pas SuperAppModule : pas de Postgres ni de Redis. La chaîne HTTP
 * (login, garde JWT, contrôleur, service) est celle de la super-app.
 */
describe('POST /api/v1/auth/logout (e2e)', () => {
  let app: INestApplication;
  const utilisateurs = new Map<string, Record<string, unknown>>();

  const userRepository = {
    findOne: jest.fn(async ({ where }: { where: { id?: string; email?: string } }) => {
      const trouve = where.id
        ? utilisateurs.get(where.id)
        : [...utilisateurs.values()].find((u) => u.email === where.email);
      return trouve ? { ...trouve } : null;
    }),
    update: jest.fn(async (critere: string | { id: string }, patch: Record<string, unknown>) => {
      const id = typeof critere === 'string' ? critere : critere.id;
      const trouve = utilisateurs.get(id);
      if (!trouve) return { affected: 0 };
      Object.assign(trouve, patch);
      return { affected: 1 };
    }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: ACCES }),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        LocalStrategy,
        JwtStrategy,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(Subscription), useValue: {} },
        {
          provide: ConfigService,
          useValue: {
            get: (cle: string, defaut?: string) => {
              const valeurs: Record<string, string> = {
                JWT_SECRET: ACCES,
                JWT_REFRESH_SECRET: REFRESH,
                JWT_EXPIRES_IN: '15m',
                JWT_REFRESH_EXPIRES_IN: '7d',
              };
              return valeurs[cle] ?? defaut;
            },
          },
        },
        { provide: OrganisationsService, useValue: { findOne: jest.fn() } },
        { provide: ProvisioningService, useValue: {} },
        { provide: DirectorInvitationService, useValue: {} },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    utilisateurs.set(USER_ID, {
      id: USER_ID,
      email: 'logout@smartbus.ci',
      password: await bcrypt.hash('Password123!', 10),
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      organisationId: null,
      refreshToken: null,
      firstName: 'Logout',
      lastName: 'Test',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('login, logout 200, puis refuse l’ancien refresh token', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'logout@smartbus.ci', password: 'Password123!' })
      .expect(200);

    const accessToken = login.body.tokens.accessToken as string;
    const refreshToken = login.body.tokens.refreshToken as string;
    expect(accessToken).toEqual(expect.any(String));
    expect(refreshToken).toEqual(expect.any(String));
    expect(utilisateurs.get(USER_ID)?.refreshToken).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(utilisateurs.get(USER_ID)?.refreshToken).toBeNull();

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });
});
