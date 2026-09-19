import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { TenantService } from '../tenant/tenant.service';
import { Course, CourseStatus, CourseType } from '@app/database';
import { Repository, DataSource } from 'typeorm';

describe('CoursesService', () => {
  let service: CoursesService;
  let tenantService: TenantService;
  let mockRepository: jest.Mocked<Repository<Course>>;

  const mockCourse: Partial<Course> = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    nom: 'Course du matin',
    statut: CourseStatus.ACTIVE,
    heureDepart: '07:00',
    heureArrivee: '08:30',
    trajetId: '123e4567-e89b-12d3-a456-426614174001',
    trajet: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    } as any;

    const mockDataSource = {
      getRepository: jest.fn().mockReturnValue(mockRepository),
    } as unknown as DataSource;

    const mockTenantService = {
      getDataSource: jest.fn().mockResolvedValue(mockDataSource),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoursesService,
        {
          provide: TenantService,
          useValue: mockTenantService,
        },
      ],
    }).compile();

    service = module.get<CoursesService>(CoursesService);
    tenantService = module.get<TenantService>(TenantService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of courses', async () => {
      const courses = [mockCourse, { ...mockCourse, id: '456' }];
      mockRepository.find.mockResolvedValue(courses as Course[]);

      const result = await service.findAll();

      expect(result).toEqual(courses);
      expect(mockRepository.find).toHaveBeenCalledWith({
        relations: { trajet: true },
        order: { createdAt: 'DESC' },
      });
      expect(tenantService.getDataSource).toHaveBeenCalled();
    });

    it('should return an empty array if no courses exist', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
      expect(mockRepository.find).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return a course by id', async () => {
      mockRepository.findOne.mockResolvedValue(mockCourse as Course);

      const result = await service.findById(mockCourse.id!);

      expect(result).toEqual(mockCourse);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockCourse.id },
        relations: { trajet: true },
      });
    });

    it('should throw NotFoundException when course not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findById('non-existent-id')).rejects.toThrow(
        'Course non-existent-id introuvable',
      );
    });
  });

  describe('findActive', () => {
    it('should return only active courses', async () => {
      const activeCourses = [
        mockCourse,
        { ...mockCourse, id: '789', statut: CourseStatus.ACTIVE },
      ];
      mockRepository.find.mockResolvedValue(activeCourses as Course[]);

      const result = await service.findActive();

      expect(result).toEqual(activeCourses);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { statut: CourseStatus.ACTIVE },
        relations: { trajet: true },
      });
    });

    it('should return empty array if no active courses', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.findActive();

      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    it('should create a new course', async () => {
      const createDto = {
        nom: 'Nouvelle course',
        type: CourseType.MATIN,
        statut: CourseStatus.ACTIVE,
        heureDepart: '07:00',
        heureArrivee: '08:30',
        trajetId: mockCourse.trajetId || '123e4567-e89b-12d3-a456-426614174001',
      };

      mockRepository.create.mockReturnValue(mockCourse as Course);
      mockRepository.save.mockResolvedValue(mockCourse as Course);

      const result = await service.create(createDto);

      expect(result).toEqual(mockCourse);
      expect(mockRepository.create).toHaveBeenCalledWith(createDto);
      expect(mockRepository.save).toHaveBeenCalledWith(mockCourse);
    });
  });

  describe('update', () => {
    it('should update an existing course', async () => {
      const updateDto = { nom: 'Course modifiée' };
      const updatedCourse = { ...mockCourse, ...updateDto };

      mockRepository.findOne.mockResolvedValue(mockCourse as Course);
      mockRepository.save.mockResolvedValue(updatedCourse as Course);

      const result = await service.update(mockCourse.id!, updateDto);

      expect(result).toEqual(updatedCourse);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when updating non-existent course', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', { nom: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('should update course status', async () => {
      const updatedCourse = {
        ...mockCourse,
        statut: CourseStatus.INACTIVE,
      };

      mockRepository.findOne.mockResolvedValue(mockCourse as Course);
      mockRepository.save.mockResolvedValue(updatedCourse as Course);

      const result = await service.updateStatus(
        mockCourse.id!,
        CourseStatus.INACTIVE,
      );

      expect(result.statut).toBe(CourseStatus.INACTIVE);
      expect(mockRepository.save).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete a course', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 1, raw: [] });

      await service.delete(mockCourse.id!);

      expect(mockRepository.delete).toHaveBeenCalledWith(mockCourse.id);
    });

    it('should not throw error when deleting non-existent course', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 0, raw: [] });

      await expect(service.delete('non-existent-id')).resolves.not.toThrow();
    });
  });
});
