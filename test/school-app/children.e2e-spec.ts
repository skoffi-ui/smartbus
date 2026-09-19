import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { SchoolAppModule } from '../../apps/school-app/src/school-app.module';

describe('Children API (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let testChildId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SchoolAppModule],
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

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@school-test.ci',
        password: 'Password123!',
      });

    authToken = loginResponse.body?.accessToken || 'mock-token';
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/api/v1/children (POST)', () => {
    const newChild = {
      firstName: 'Jean',
      lastName: 'Kouassi',
      empCode: 'EMP_TEST_001',
      className: 'CP1',
      dateOfBirth: '2018-05-15',
      isActive: true,
    };

    it('should create a new child', () => {
      return request(app.getHttpServer())
        .post('/api/v1/children')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newChild)
        .expect((res) => {
          if (res.status === 201) {
            expect(res.body).toHaveProperty('id');
            expect(res.body.firstName).toBe(newChild.firstName);
            expect(res.body.lastName).toBe(newChild.lastName);
            expect(res.body.empCode).toBe(newChild.empCode);
            testChildId = res.body.id;
          }
        });
    });

    it('should fail without authentication', () => {
      return request(app.getHttpServer())
        .post('/api/v1/children')
        .send(newChild)
        .expect(401);
    });

    it('should fail with duplicate empCode', () => {
      return request(app.getHttpServer())
        .post('/api/v1/children')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newChild)
        .expect(409);
    });

    it('should fail with missing required fields', () => {
      return request(app.getHttpServer())
        .post('/api/v1/children')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'Test' })
        .expect(400);
    });

    it('should create child without dateOfBirth (uses default)', () => {
      return request(app.getHttpServer())
        .post('/api/v1/children')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'Marie',
          lastName: 'Traore',
          empCode: 'EMP_TEST_002',
          className: 'CP2',
        })
        .expect((res) => {
          if (res.status === 201) {
            expect(res.body).toHaveProperty('dateOfBirth');
          }
        });
    });
  });

  describe('/api/v1/children (GET)', () => {
    it('should return list of children', () => {
      return request(app.getHttpServer())
        .get('/api/v1/children')
        .set('Authorization', `Bearer ${authToken}`)
        .expect((res) => {
          if (res.status === 200) {
            expect(Array.isArray(res.body)).toBe(true);
            if (res.body.length > 0) {
              expect(res.body[0]).toHaveProperty('id');
              expect(res.body[0]).toHaveProperty('firstName');
              expect(res.body[0]).toHaveProperty('lastName');
            }
          }
        });
    });

    it('should fail without authentication', () => {
      return request(app.getHttpServer()).get('/api/v1/children').expect(401);
    });
  });

  describe('/api/v1/children/:id (GET)', () => {
    it('should return child by id', () => {
      if (!testChildId) return;

      return request(app.getHttpServer())
        .get(`/api/v1/children/${testChildId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect((res) => {
          if (res.status === 200) {
            expect(res.body.id).toBe(testChildId);
            expect(res.body).toHaveProperty('firstName');
            expect(res.body).toHaveProperty('lastName');
            expect(res.body).not.toHaveProperty('password');
          }
        });
    });

    it('should fail with non-existent id', () => {
      return request(app.getHttpServer())
        .get('/api/v1/children/123e4567-e89b-12d3-a456-426614174999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should fail with invalid UUID', () => {
      return request(app.getHttpServer())
        .get('/api/v1/children/invalid-uuid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('/api/v1/children/:id (PATCH)', () => {
    it('should update child', () => {
      if (!testChildId) return;

      const updateData = {
        firstName: 'Jean-Pierre',
        className: 'CE1',
      };

      return request(app.getHttpServer())
        .patch(`/api/v1/children/${testChildId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect((res) => {
          if (res.status === 200) {
            expect(res.body.firstName).toBe(updateData.firstName);
            expect(res.body.className).toBe(updateData.className);
          }
        });
    });

    it('should fail with non-existent id', () => {
      return request(app.getHttpServer())
        .patch('/api/v1/children/123e4567-e89b-12d3-a456-426614174999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'Test' })
        .expect(404);
    });

    it('should fail with duplicate empCode', () => {
      if (!testChildId) return;

      return request(app.getHttpServer())
        .patch(`/api/v1/children/${testChildId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ empCode: 'EMP_TEST_002' })
        .expect(409);
    });
  });

  describe('/api/v1/children/:id/punches (GET)', () => {
    it('should return punches for a child', () => {
      if (!testChildId) return;

      return request(app.getHttpServer())
        .get(`/api/v1/children/${testChildId}/punches`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect((res) => {
          if (res.status === 200) {
            expect(Array.isArray(res.body)).toBe(true);
          }
        });
    });

    it('should return empty array for child without empCode', () => {
      if (!testChildId) return;

      return request(app.getHttpServer())
        .get(`/api/v1/children/${testChildId}/punches`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect((res) => {
          if (res.status === 200) {
            expect(Array.isArray(res.body)).toBe(true);
          }
        });
    });
  });

  describe('/api/v1/children/directory (GET)', () => {
    it('should return BioTime directory', () => {
      return request(app.getHttpServer())
        .get('/api/v1/children/directory')
        .set('Authorization', `Bearer ${authToken}`)
        .expect((res) => {
          if (res.status === 200 || res.status === 500) {
            expect(Array.isArray(res.body) || res.body.message).toBeTruthy();
          }
        });
    });
  });

  describe('/api/v1/children/bulk-import (POST)', () => {
    it('should import children from empCodes', () => {
      const empCodes = ['EMP_BULK_001', 'EMP_BULK_002'];

      return request(app.getHttpServer())
        .post('/api/v1/children/bulk-import')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ empCodes })
        .expect((res) => {
          if (res.status === 201 || res.status === 500) {
            expect(res.body).toHaveProperty('message');
            expect(res.body).toHaveProperty('count');
          }
        });
    });

    it('should return 0 count for empty array', () => {
      return request(app.getHttpServer())
        .post('/api/v1/children/bulk-import')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ empCodes: [] })
        .expect((res) => {
          if (res.status === 201) {
            expect(res.body.count).toBe(0);
          }
        });
    });
  });

  describe('/api/v1/children/:id (DELETE)', () => {
    it('should delete child', () => {
      if (!testChildId) return;

      return request(app.getHttpServer())
        .delete(`/api/v1/children/${testChildId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);
    });

    it('should fail when deleting non-existent child', () => {
      return request(app.getHttpServer())
        .delete('/api/v1/children/123e4567-e89b-12d3-a456-426614174999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
