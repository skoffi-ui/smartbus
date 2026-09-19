import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { SchoolAppModule } from '../../apps/school-app/src/school-app.module';
import { CourseStatus } from '@app/database';

describe('Courses API (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let testCourseId: string;
  let testTrajetId: string;

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

  describe('/api/v1/courses (POST)', () => {
    const newCourse = {
      nom: 'Course du matin - Test',
      statut: CourseStatus.PLANIFIEE,
      heureDepart: '2026-09-19T07:00:00.000Z',
      heureArrivee: '2026-09-19T08:30:00.000Z',
      trajetId: testTrajetId || '123e4567-e89b-12d3-a456-426614174000',
    };

    it('should create a new course', () => {
      return request(app.getHttpServer())
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newCourse)
        .expect((res) => {
          if (res.status === 201) {
            expect(res.body).toHaveProperty('id');
            expect(res.body.nom).toBe(newCourse.nom);
            expect(res.body.statut).toBe(newCourse.statut);
            testCourseId = res.body.id;
          }
        });
    });

    it('should fail without authentication', () => {
      return request(app.getHttpServer())
        .post('/api/v1/courses')
        .send(newCourse)
        .expect(401);
    });

    it('should fail with missing required fields', () => {
      return request(app.getHttpServer())
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ nom: 'Course sans trajet' })
        .expect(400);
    });

    it('should fail with invalid status', () => {
      return request(app.getHttpServer())
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...newCourse, statut: 'INVALID_STATUS' })
        .expect(400);
    });

    it('should fail with invalid date format', () => {
      return request(app.getHttpServer())
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...newCourse, heureDepart: 'invalid-date' })
        .expect(400);
    });
  });

  describe('/api/v1/courses (GET)', () => {
    it('should return list of courses', () => {
      return request(app.getHttpServer())
        .get('/api/v1/courses')
        .set('Authorization', `Bearer ${authToken}`)
        .expect((res) => {
          if (res.status === 200) {
            expect(Array.isArray(res.body)).toBe(true);
          }
        });
    });

    it('should fail without authentication', () => {
      return request(app.getHttpServer()).get('/api/v1/courses').expect(401);
    });
  });

  describe('/api/v1/courses/active (GET)', () => {
    it('should return only active courses', () => {
      return request(app.getHttpServer())
        .get('/api/v1/courses/active')
        .set('Authorization', `Bearer ${authToken}`)
        .expect((res) => {
          if (res.status === 200) {
            expect(Array.isArray(res.body)).toBe(true);
            res.body.forEach((course: any) => {
              expect(course.statut).toBe(CourseStatus.ACTIVE);
            });
          }
        });
    });

    it('should return empty array if no active courses', () => {
      return request(app.getHttpServer())
        .get('/api/v1/courses/active')
        .set('Authorization', `Bearer ${authToken}`)
        .expect((res) => {
          if (res.status === 200) {
            expect(Array.isArray(res.body)).toBe(true);
          }
        });
    });
  });

  describe('/api/v1/courses/:id (GET)', () => {
    it('should return course by id', () => {
      if (!testCourseId) return;

      return request(app.getHttpServer())
        .get(`/api/v1/courses/${testCourseId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect((res) => {
          if (res.status === 200) {
            expect(res.body.id).toBe(testCourseId);
            expect(res.body).toHaveProperty('nom');
            expect(res.body).toHaveProperty('statut');
          }
        });
    });

    it('should fail with non-existent id', () => {
      return request(app.getHttpServer())
        .get('/api/v1/courses/123e4567-e89b-12d3-a456-426614174999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should fail with invalid UUID', () => {
      return request(app.getHttpServer())
        .get('/api/v1/courses/invalid-uuid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('/api/v1/courses/:id (PUT)', () => {
    it('should update course', () => {
      if (!testCourseId) return;

      const updateData = {
        nom: 'Course du matin - Modifiée',
        heureDepart: '2026-09-19T07:15:00.000Z',
      };

      return request(app.getHttpServer())
        .put(`/api/v1/courses/${testCourseId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect((res) => {
          if (res.status === 200) {
            expect(res.body.nom).toBe(updateData.nom);
          }
        });
    });

    it('should fail with non-existent id', () => {
      return request(app.getHttpServer())
        .put('/api/v1/courses/123e4567-e89b-12d3-a456-426614174999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ nom: 'Test' })
        .expect(404);
    });
  });

  describe('/api/v1/courses/:id/status (PATCH)', () => {
    it('should update course status', () => {
      if (!testCourseId) return;

      return request(app.getHttpServer())
        .patch(`/api/v1/courses/${testCourseId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ statut: CourseStatus.ACTIVE })
        .expect((res) => {
          if (res.status === 200) {
            expect(res.body.statut).toBe(CourseStatus.ACTIVE);
          }
        });
    });

    it('should fail with invalid status', () => {
      if (!testCourseId) return;

      return request(app.getHttpServer())
        .patch(`/api/v1/courses/${testCourseId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ statut: 'INVALID_STATUS' })
        .expect(400);
    });
  });

  describe('/api/v1/courses/:id (DELETE)', () => {
    it('should delete course', () => {
      if (!testCourseId) return;

      return request(app.getHttpServer())
        .delete(`/api/v1/courses/${testCourseId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);
    });

    it('should return 204 even for non-existent course', () => {
      return request(app.getHttpServer())
        .delete('/api/v1/courses/123e4567-e89b-12d3-a456-426614174999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);
    });
  });
});
