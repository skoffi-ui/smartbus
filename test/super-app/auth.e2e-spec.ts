import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { SuperAppModule } from '../../apps/super-app/src/super-app.module';
import { DataSource } from 'typeorm';
import { User, UserRole, UserStatus } from '@app/database';
import * as bcrypt from 'bcrypt';

describe('Auth API (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let authToken: string;
  let testUserId: string;

  const testUser = {
    firstName: 'Test',
    lastName: 'User',
    email: 'test@smartbus.ci',
    password: 'Password123!',
    phoneNumber: '+225012345678',
    role: UserRole.SUPER_ADMIN,
    status: UserStatus.ACTIVE,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SuperAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.enableCors();

    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    const userRepo = dataSource.getRepository(User);
    const hashedPassword = await bcrypt.hash(testUser.password, 10);
    const user = userRepo.create({
      ...testUser,
      password: hashedPassword,
    });
    const savedUser = await userRepo.save(user);
    testUserId = savedUser.id;
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      const userRepo = dataSource.getRepository(User);
      await userRepo.delete({ email: testUser.email });
    }
    await app.close();
  });

  describe('/api/v1/auth/login (POST)', () => {
    it('should login with valid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
          expect(res.body).toHaveProperty('user');
          expect(res.body.user.email).toBe(testUser.email);
          authToken = res.body.accessToken;
        });
    });

    it('should fail with invalid email', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'wrong@example.com',
          password: testUser.password,
        })
        .expect(401);
    });

    it('should fail with invalid password', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword',
        })
        .expect(401);
    });

    it('should fail with missing fields', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: testUser.email })
        .expect(400);
    });

    it('should fail with invalid email format', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'not-an-email',
          password: testUser.password,
        })
        .expect(400);
    });
  });

  describe('/api/v1/auth/register (POST)', () => {
    const newUser = {
      firstName: 'New',
      lastName: 'User',
      email: 'newuser@smartbus.ci',
      password: 'Password123!',
      phoneNumber: '+225012345679',
    };

    afterEach(async () => {
      const userRepo = dataSource.getRepository(User);
      await userRepo.delete({ email: newUser.email });
    });

    it('should register a new user', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(newUser)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.email).toBe(newUser.email);
          expect(res.body).not.toHaveProperty('password');
        });
    });

    it('should fail with duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(newUser)
        .expect(201);

      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(newUser)
        .expect(409);
    });

    it('should fail with weak password', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ ...newUser, password: '123' })
        .expect(400);
    });

    it('should fail with invalid email', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ ...newUser, email: 'invalid-email' })
        .expect(400);
    });
  });

  describe('/api/v1/auth/me (GET)', () => {
    it('should return current user with valid token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.email).toBe(testUser.email);
          expect(res.body).toHaveProperty('id');
          expect(res.body).not.toHaveProperty('password');
        });
    });

    it('should fail without token', () => {
      return request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });

    it('should fail with invalid token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('/api/v1/auth/refresh (POST)', () => {
    let refreshToken: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        });

      refreshToken = response.body.refreshToken;
    });

    it('should refresh access token with valid refresh token', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
        });
    });

    it('should fail with invalid refresh token', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);
    });
  });

  describe('/api/v1/auth/logout (POST)', () => {
    it('should logout successfully', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });

    it('should fail without token', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .expect(401);
    });
  });
});
