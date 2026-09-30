import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { SuperAppModule } from '../../apps/super-app/src/super-app.module';
import { DataSource } from 'typeorm';
import { User, UserRole, UserStatus, Organisation } from '@app/database';
import * as bcrypt from 'bcrypt';

describe('Organisations API (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let authToken: string;
  let testOrganisationId: string;

  const superAdmin = {
    firstName: 'Super',
    lastName: 'Admin',
    email: 'superadmin@smartbus.ci',
    password: 'AdminPassword123!',
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
    const hashedPassword = await bcrypt.hash(superAdmin.password, 10);
    const user = userRepo.create({
      ...superAdmin,
      password: hashedPassword,
    });
    await userRepo.save(user);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: superAdmin.email,
        password: superAdmin.password,
      });

    authToken = loginResponse.body.accessToken;
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      const orgRepo = dataSource.getRepository(Organisation);
      const userRepo = dataSource.getRepository(User);

      if (testOrganisationId) {
        await orgRepo.delete({ id: testOrganisationId });
      }
      await userRepo.delete({ email: superAdmin.email });
    }
    await app.close();
  });

  describe('/api/v1/organisations (POST)', () => {
    const newOrg = {
      name: 'École Primaire de Test',
      slug: 'ecole-test',
      contactEmail: 'contact@ecole-test.ci',
      contactPhone: '+225012345680',
      address: '123 Rue de Test',
      city: 'Abidjan',
      country: "Côte d'Ivoire",
    };

    it('should create a new organisation', () => {
      return request(app.getHttpServer())
        .post('/api/v1/organisations')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newOrg)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toBe(newOrg.name);
          expect(res.body.slug).toBe(newOrg.slug);
          expect(res.body.isActive).toBe(true);
          testOrganisationId = res.body.id;
        });
    });

    it('should fail without authentication', () => {
      return request(app.getHttpServer())
        .post('/api/v1/organisations')
        .send(newOrg)
        .expect(401);
    });

    it('should fail with duplicate slug', () => {
      return request(app.getHttpServer())
        .post('/api/v1/organisations')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newOrg)
        .expect(409);
    });

    it('should fail with missing required fields', () => {
      return request(app.getHttpServer())
        .post('/api/v1/organisations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test Org' })
        .expect(400);
    });

    it('should fail with invalid email', () => {
      return request(app.getHttpServer())
        .post('/api/v1/organisations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...newOrg, contactEmail: 'invalid-email', slug: 'test-2' })
        .expect(400);
    });
  });

  describe('/api/v1/organisations (GET)', () => {
    it('should return list of organisations', () => {
      return request(app.getHttpServer())
        .get('/api/v1/organisations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          expect(res.body[0]).toHaveProperty('id');
          expect(res.body[0]).toHaveProperty('name');
        });
    });

    it('should fail without authentication', () => {
      return request(app.getHttpServer())
        .get('/api/v1/organisations')
        .expect(401);
    });

    it('should support pagination', () => {
      return request(app.getHttpServer())
        .get('/api/v1/organisations?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('meta');
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });
  });

  describe('/api/v1/organisations/:id (GET)', () => {
    it('should return organisation by id', () => {
      return request(app.getHttpServer())
        .get(`/api/v1/organisations/${testOrganisationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(testOrganisationId);
          expect(res.body).toHaveProperty('name');
        });
    });

    it('should fail with non-existent id', () => {
      return request(app.getHttpServer())
        .get('/api/v1/organisations/123e4567-e89b-12d3-a456-426614174999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should fail with invalid UUID', () => {
      return request(app.getHttpServer())
        .get('/api/v1/organisations/invalid-uuid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('/api/v1/organisations/:id (PATCH)', () => {
    it('should update organisation', () => {
      const updateData = {
        name: 'École Primaire de Test - Mise à jour',
        contactPhone: '+225012345681',
      };

      return request(app.getHttpServer())
        .patch(`/api/v1/organisations/${testOrganisationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe(updateData.name);
          expect(res.body.contactPhone).toBe(updateData.contactPhone);
        });
    });

    it('should fail with non-existent id', () => {
      return request(app.getHttpServer())
        .patch('/api/v1/organisations/123e4567-e89b-12d3-a456-426614174999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test' })
        .expect(404);
    });
  });

  describe('/api/v1/organisations/:id/deactivate (PATCH)', () => {
    it('should deactivate organisation', () => {
      return request(app.getHttpServer())
        .patch(`/api/v1/organisations/${testOrganisationId}/deactivate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.isActive).toBe(false);
        });
    });
  });

  describe('/api/v1/organisations/:id/activate (PATCH)', () => {
    it('should activate organisation', () => {
      return request(app.getHttpServer())
        .patch(`/api/v1/organisations/${testOrganisationId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.isActive).toBe(true);
        });
    });
  });

  describe('/api/v1/organisations/:id (DELETE)', () => {
    it('should delete organisation', () => {
      return request(app.getHttpServer())
        .delete(`/api/v1/organisations/${testOrganisationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);
    });

    it('should fail when deleting non-existent organisation', () => {
      return request(app.getHttpServer())
        .delete('/api/v1/organisations/123e4567-e89b-12d3-a456-426614174999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
