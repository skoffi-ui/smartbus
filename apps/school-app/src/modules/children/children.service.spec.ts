import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { ChildrenService } from './children.service';
import { TenantService } from '../tenant/tenant.service';
import { Child } from '@app/database/tenant-entities/child.entity';
import { Parent } from '@app/database/tenant-entities/parent.entity';
import { Repository, DataSource } from 'typeorm';

describe('ChildrenService', () => {
  let service: ChildrenService;
  let tenantService: TenantService;
  let httpService: HttpService;
  let mockChildRepo: jest.Mocked<Repository<Child>>;
  let mockParentRepo: jest.Mocked<Repository<Parent>>;

  const mockChild: Partial<Child> = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    firstName: 'Jean',
    lastName: 'Dupont',
    empCode: 'EMP001',
    className: 'CP1',
    dateOfBirth: new Date('2018-05-15'),
    isActive: true,
    photoUrl: 'http://160.120.143.20:8080/photo/001.jpg',
    parentId: '456e4567-e89b-12d3-a456-426614174001',
    parent: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockParent: Partial<Parent> = {
    id: '456e4567-e89b-12d3-a456-426614174001',
    firstName: 'Marie',
    lastName: 'Dupont',
    phone: '+225012345678',
  };

  beforeEach(async () => {
    mockChildRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      // Appelé par `update()` pour marquer la synchro BioTime PENDING avant le push.
      update: jest.fn(),
    } as any;

    mockParentRepo = {
      findOne: jest.fn(),
    } as any;

    const mockDataSource = {
      getRepository: jest.fn((entity) => {
        if (entity.name === 'Child') return mockChildRepo;
        if (entity.name === 'Parent') return mockParentRepo;
        return mockChildRepo;
      }),
    } as unknown as DataSource;

    const mockTenantService = {
      getDataSource: jest.fn().mockResolvedValue(mockDataSource),
    };

    const mockHttpService = {
      get: jest.fn(),
      post: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChildrenService,
        {
          provide: TenantService,
          useValue: mockTenantService,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: (clef: string, defaut?: string) =>
              clef === 'SUPER_APP_URL' ? 'http://localhost:3000' : defaut,
          },
        },
      ],
    }).compile();

    service = module.get<ChildrenService>(ChildrenService);
    tenantService = module.get<TenantService>(TenantService);
    httpService = module.get<HttpService>(HttpService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of children', async () => {
      const children = [mockChild, { ...mockChild, id: '789' }];
      mockChildRepo.find.mockResolvedValue(children as Child[]);

      const result = await service.findAll();

      expect(result).toEqual(children);
      expect(mockChildRepo.find).toHaveBeenCalledWith({
        relations: { parent: true },
        order: { createdAt: 'DESC' },
      });
    });

    it('should return empty array when no children exist', async () => {
      mockChildRepo.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a child by id', async () => {
      mockChildRepo.findOne.mockResolvedValue(mockChild as Child);

      const result = await service.findOne(mockChild.id!);

      expect(result).toEqual(mockChild);
      expect(mockChildRepo.findOne).toHaveBeenCalledWith({
        where: { id: mockChild.id },
        relations: { parent: true },
      });
    });

    it('should throw NotFoundException when child not found', async () => {
      mockChildRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should auto-sync photo from super-app if missing', async () => {
      const childWithoutPhoto = { ...mockChild, photoUrl: undefined };
      mockChildRepo.findOne.mockResolvedValue(childWithoutPhoto as any);
      mockChildRepo.save.mockResolvedValue({
        ...childWithoutPhoto,
        photoUrl: 'http://160.120.143.20:8080/photo/001.jpg',
      } as Child);

      const mockResponse = {
        data: { photo: '/photo/001.jpg' },
      };
      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as any));

      // Le jeton du responsable est relayé : la super-app en déduit l'école, et
      // ne renvoie que l'annuaire BioTime de cet établissement.
      const result = await service.findOne(mockChild.id!, 'jeton-ecole');

      expect(httpService.get).toHaveBeenCalledWith(
        `http://localhost:3000/api/v1/biotime/mon-ecole/employee/${mockChild.empCode}`,
        { headers: { Authorization: 'Bearer jeton-ecole' } },
      );
      expect(mockChildRepo.save).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('should create a new child', async () => {
      const createDto = {
        firstName: 'Jean',
        lastName: 'Dupont',
        empCode: 'EMP002',
        className: 'CP1',
        dateOfBirth: '2018-05-15',
        parentId: mockParent.id,
      };

      mockChildRepo.findOne.mockResolvedValue(null);
      mockParentRepo.findOne.mockResolvedValue(mockParent as Parent);
      mockChildRepo.create.mockReturnValue(mockChild as Child);
      mockChildRepo.save.mockResolvedValue(mockChild as Child);

      const result = await service.create(createDto);

      expect(result).toEqual(mockChild);
      expect(mockChildRepo.create).toHaveBeenCalled();
      expect(mockChildRepo.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if empCode already exists', async () => {
      const createDto = {
        firstName: 'Jean',
        lastName: 'Dupont',
        empCode: 'EMP001',
        className: 'CP1',
      };

      mockChildRepo.findOne.mockResolvedValue(mockChild as Child);

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should set default dateOfBirth if not provided', async () => {
      const createDto = {
        firstName: 'Jean',
        lastName: 'Dupont',
        empCode: 'EMP003',
        className: 'CP1',
      };

      mockChildRepo.findOne.mockResolvedValue(null);
      mockChildRepo.create.mockReturnValue(mockChild as Child);
      mockChildRepo.save.mockResolvedValue(mockChild as Child);

      await service.create(createDto);

      expect(createDto).toHaveProperty('dateOfBirth', '2015-01-01');
    });

    it('should throw NotFoundException if parent not found', async () => {
      const createDto = {
        firstName: 'Jean',
        lastName: 'Dupont',
        empCode: 'EMP004',
        className: 'CP1',
        parentId: 'non-existent-parent',
      };

      mockChildRepo.findOne.mockResolvedValue(null);
      mockParentRepo.findOne.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a child', async () => {
      const updateDto = { firstName: 'Pierre' };
      const updatedChild = { ...mockChild, ...updateDto };

      mockChildRepo.findOne.mockResolvedValue(mockChild as Child);
      mockChildRepo.save.mockResolvedValue(updatedChild as Child);

      const result = await service.update(mockChild.id!, updateDto);

      expect(result).toEqual(updatedChild);
      expect(mockChildRepo.save).toHaveBeenCalled();
    });

    it('should throw ConflictException when updating to existing empCode', async () => {
      const updateDto = { empCode: 'EMP999' };
      const existingChild = { ...mockChild, id: 'other-id' };

      mockChildRepo.findOne
        .mockResolvedValueOnce(mockChild as Child)
        .mockResolvedValueOnce(existingChild as Child);

      await expect(service.update(mockChild.id!, updateDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('remove', () => {
    it('should remove a child', async () => {
      mockChildRepo.findOne.mockResolvedValue(mockChild as Child);
      mockChildRepo.remove.mockResolvedValue(mockChild as Child);

      await service.remove(mockChild.id!);

      expect(mockChildRepo.remove).toHaveBeenCalledWith(mockChild);
    });
  });

  describe('getPunches', () => {
    it('should return punches for a child', async () => {
      const mockPunches = [
        { id: 1, empCode: 'EMP001', time: '2026-09-19T07:30:00' },
      ];

      mockChildRepo.findOne.mockResolvedValue(mockChild as Child);
      jest
        .spyOn(httpService, 'get')
        .mockReturnValue(of({ data: mockPunches } as any));

      const result = await service.getPunches(mockChild.id!);

      expect(result).toEqual(mockPunches);
      expect(httpService.get).toHaveBeenCalledWith(
        `http://localhost:3000/api/v1/biotime/mon-ecole/punches/empcode/${mockChild.empCode}`,
        { headers: {} },
      );
    });

    it('should return empty array if child has no empCode', async () => {
      const childWithoutEmpCode = { ...mockChild, empCode: undefined };
      mockChildRepo.findOne.mockResolvedValue(childWithoutEmpCode as any);

      const result = await service.getPunches(mockChild.id!);

      expect(result).toEqual([]);
      expect(httpService.get).not.toHaveBeenCalled();
    });

    it('should return empty array on HTTP error', async () => {
      mockChildRepo.findOne.mockResolvedValue(mockChild as Child);
      jest.spyOn(httpService, 'get').mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      const result = await service.getPunches(mockChild.id!);

      expect(result).toEqual([]);
    });
  });

  describe('bulkImport', () => {
    it('should import children from empCodes', async () => {
      const empCodes = ['EMP010', 'EMP011'];
      const mockEmployees = [
        {
          empCode: 'EMP010',
          firstName: 'Alice',
          lastName: 'Martin',
          departmentName: 'CE1',
          photo: '/photo/010.jpg',
        },
      ];

      mockChildRepo.findOne.mockResolvedValue(null);
      mockChildRepo.create.mockReturnValue({} as Child);
      mockChildRepo.save.mockResolvedValue({} as Child);

      jest
        .spyOn(httpService, 'post')
        .mockReturnValue(of({ data: mockEmployees } as any));

      const result = await service.bulkImport(empCodes);

      expect(result.count).toBe(1);
      expect(httpService.post).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/biotime/mon-ecole/directory/bulk',
        { empCodes },
        { headers: {} },
      );
    });

    it('should return 0 count if no empCodes provided', async () => {
      const result = await service.bulkImport([]);

      expect(result.count).toBe(0);
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('should throw HttpException on API error', async () => {
      jest
        .spyOn(httpService, 'post')
        .mockReturnValue(throwError(() => new Error('API error')));

      await expect(service.bulkImport(['EMP001'])).rejects.toThrow(
        HttpException,
      );
    });
  });
});
