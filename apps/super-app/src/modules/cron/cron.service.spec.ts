import { Test, TestingModule } from '@nestjs/testing';
import { ModuleRef } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { DataSource } from 'typeorm';
import {
  Organisation,
  OrganisationStatus,
  Subscription,
  SubscriptionStatus,
  TenantConnectionService,
} from '@app/database';
import { BiotimeConfigService } from '../biotime/biotime-config.service';
import { CronService } from './cron.service';

/**
 * Tâches planifiées.
 *
 * Le point critique est la **portée** du service : `@nestjs/schedule` n'enregistre
 * les tâches `@Cron` que sur des fournisseurs statiques. Injecter un service en
 * portée requête propageait cette portée et faisait taire toutes les tâches, avec
 * pour seule trace un avertissement au démarrage.
 */
describe('CronService', () => {
  const ORG_A = 'org-aaaa-1111';
  const ORG_B = 'org-bbbb-2222';

  let module: TestingModule;
  let service: CronService;

  const subscriptionRepo = { find: jest.fn(), save: jest.fn() };
  const organisationRepo = { find: jest.fn(), save: jest.fn() };
  const queue = { add: jest.fn() };
  const biotimeConfig = { listerActives: jest.fn() };
  const tenantQuery = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    subscriptionRepo.find.mockResolvedValue([]);
    organisationRepo.find.mockResolvedValue([]);
    biotimeConfig.listerActives.mockResolvedValue([]);
    tenantQuery.mockResolvedValue([]);

    module = await Test.createTestingModule({
      providers: [
        CronService,
        {
          provide: getRepositoryToken(Subscription),
          useValue: subscriptionRepo,
        },
        {
          provide: getRepositoryToken(Organisation),
          useValue: organisationRepo,
        },
        { provide: DataSource, useValue: {} },
        { provide: getQueueToken('biotime-sync'), useValue: queue },
        { provide: BiotimeConfigService, useValue: biotimeConfig },
      ],
    }).compile();

    // La connexion tenant est résolue à la demande, hors contexte HTTP.
    jest.spyOn(module.get(ModuleRef), 'resolve').mockResolvedValue({
      getTenantConnection: jest.fn(async () => ({ query: tenantQuery })),
    } as unknown as TenantConnectionService);

    service = module.get<CronService>(CronService);
  });

  it('reste un fournisseur statique, sinon aucune tâche ne serait planifiée', () => {
    // `module.get()` lève une exception sur un fournisseur en portée requête ou
    // transitoire — exactement le critère qu'applique @nestjs/schedule.
    expect(() => module.get(CronService)).not.toThrow();
    expect(service).toBeDefined();
  });

  describe('handleDeviceHeartbeats', () => {
    it('interroge la base de chaque école provisionnée', async () => {
      organisationRepo.find.mockResolvedValue([
        { id: ORG_A, name: 'École A' },
        { id: ORG_B, name: 'École B' },
      ]);

      await service.handleDeviceHeartbeats();

      expect(tenantQuery).toHaveBeenCalledTimes(2);
      expect(organisationRepo.find).toHaveBeenCalledWith({
        where: { dbProvisioned: true },
      });
    });

    it("poursuit avec les autres écoles si l'une est injoignable", async () => {
      organisationRepo.find.mockResolvedValue([
        { id: ORG_A, name: 'École A' },
        { id: ORG_B, name: 'École B' },
      ]);
      tenantQuery
        .mockRejectedValueOnce(new Error('base indisponible'))
        .mockResolvedValueOnce([]);

      // Une école en panne ne doit pas interrompre la surveillance du parc.
      await expect(service.handleDeviceHeartbeats()).resolves.toBeUndefined();
      expect(tenantQuery).toHaveBeenCalledTimes(2);
    });

    it("ne touche aucune base si aucune école n'est provisionnée", async () => {
      await service.handleDeviceHeartbeats();

      expect(tenantQuery).not.toHaveBeenCalled();
    });
  });

  describe('handleSubscriptionExpirations', () => {
    it('suspend école et abonnement à échéance dépassée', async () => {
      const organisation = {
        id: ORG_A,
        name: 'École A',
        status: OrganisationStatus.ACTIVE,
      };
      subscriptionRepo.find.mockResolvedValue([
        { id: 'sub-1', status: SubscriptionStatus.ACTIVE, organisation },
      ]);

      await service.handleSubscriptionExpirations();

      expect(subscriptionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: SubscriptionStatus.EXPIRED }),
      );
      expect(organisationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: OrganisationStatus.SUSPENDED }),
      );
    });

    it('ne touche à rien sans abonnement expiré', async () => {
      await service.handleSubscriptionExpirations();

      expect(subscriptionRepo.save).not.toHaveBeenCalled();
      expect(organisationRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('synchronisation BioTime', () => {
    it('enfile un seul job de pointages, le worker parcourant les écoles', async () => {
      await service.triggerBioTimePunchesSync();

      expect(queue.add).toHaveBeenCalledTimes(1);
      expect(queue.add).toHaveBeenCalledWith('sync-punches', {});
    });

    it("enfile un job d'annuaire par école configurée", async () => {
      biotimeConfig.listerActives.mockResolvedValue([
        { organisationId: ORG_A },
        { organisationId: ORG_B },
      ]);

      await service.triggerBioTimeChildrenSync();

      expect(queue.add).toHaveBeenCalledTimes(2);
      expect(queue.add).toHaveBeenCalledWith('sync-children', {
        organisationId: ORG_A,
      });
      expect(queue.add).toHaveBeenCalledWith('sync-children', {
        organisationId: ORG_B,
      });
    });

    it("n'enfile rien si aucune école n'a de serveur BioTime", async () => {
      await service.triggerBioTimeChildrenSync();

      expect(queue.add).not.toHaveBeenCalled();
    });
  });
});
