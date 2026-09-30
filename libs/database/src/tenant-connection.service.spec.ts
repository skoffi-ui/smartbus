import { Test, TestingModule } from '@nestjs/testing';
import { REQUEST } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { TenantConnectionService } from './tenant-connection.service';
import { Organisation } from './entities/organisation.entity';
import {
  InternalServerErrorException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

describe('TenantConnectionService', () => {
  let service: TenantConnectionService;
  let mockRequest: any;
  let mockOrganisationRepository: jest.Mocked<Repository<Organisation>>;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    mockRequest = {
      headers: {},
      user: null,
    };

    mockOrganisationRepository = {
      findOne: jest.fn(),
    } as any;

    mockConfigService = {
      get: jest
        .fn()
        .mockImplementation((key: string, defaultValue?: any) => defaultValue),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantConnectionService,
        {
          provide: REQUEST,
          useValue: mockRequest,
        },
        {
          provide: getRepositoryToken(Organisation),
          useValue: mockOrganisationRepository,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = await module.resolve<TenantConnectionService>(
      TenantConnectionService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw InternalServerErrorException if no tenant header or user exists', async () => {
    await expect(service.getTenantConnection()).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('should throw NotFoundException if organisation is not found', async () => {
    mockRequest.headers['x-tenant-id'] = 'invalid-tenant-id';
    mockOrganisationRepository.findOne.mockResolvedValue(null);

    await expect(service.getTenantConnection()).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw InternalServerErrorException if organisation is not provisioned', async () => {
    mockRequest.headers['x-tenant-id'] = 'unprovisioned-tenant-id';
    mockOrganisationRepository.findOne.mockResolvedValue({
      id: 'unprovisioned-tenant-id',
      dbProvisioned: false,
      dbName: null,
      status: 'active',
    } as any);

    await expect(service.getTenantConnection()).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('should throw ForbiddenException if organisation is suspended', async () => {
    mockRequest.headers['x-tenant-id'] = 'suspended-tenant-id';
    mockOrganisationRepository.findOne.mockResolvedValue({
      id: 'suspended-tenant-id',
      dbProvisioned: true,
      dbName: 'school_db',
      status: 'suspended',
    } as any);

    await expect(service.getTenantConnection()).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('accepte une école en essai gratuit (trial) : elle passe le contrôle de statut', async () => {
    mockRequest.headers['x-tenant-id'] = 'trial-tenant-id';
    mockOrganisationRepository.findOne.mockResolvedValue({
      id: 'trial-tenant-id',
      dbProvisioned: false,
      dbName: null,
      status: 'trial',
    } as any);

    // Si trial était refusé, on aurait un ForbiddenException avant le contrôle de provisionnement
    await expect(service.getTenantConnection()).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('refuse une organisation en attente (pending)', async () => {
    mockRequest.headers['x-tenant-id'] = 'pending-tenant-id';
    mockOrganisationRepository.findOne.mockResolvedValue({
      id: 'pending-tenant-id',
      dbProvisioned: true,
      dbName: 'db',
      status: 'pending',
    } as any);

    await expect(service.getTenantConnection()).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("l'organisation du JWT prime sur un header x-tenant-id usurpé", async () => {
    mockRequest.user = { organisationId: 'org-jwt' };
    mockRequest.headers['x-tenant-id'] = 'org-usurpee';
    mockOrganisationRepository.findOne.mockResolvedValue(null);

    await expect(service.getTenantConnection()).rejects.toThrow(
      NotFoundException,
    );
    expect(mockOrganisationRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'org-jwt' } }),
    );
  });
});
