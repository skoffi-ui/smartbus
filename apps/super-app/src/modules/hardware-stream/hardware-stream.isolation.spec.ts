import { ForbiddenException } from '@nestjs/common';
import { HardwareStreamService, LiveCarPosition } from './hardware-stream.service';
import { HardwareStreamController } from './hardware-stream.controller';

/**
 * Cloisonnement des positions GPS entre écoles.
 *
 * Exigence : l'école A ne doit jamais voir les bus de l'école B.
 */
describe('Isolation GPS entre écoles', () => {
  const ORG_A = 'org-aaaa-1111';
  const ORG_B = 'org-bbbb-2222';

  let service: HardwareStreamService;
  let centralQuery: jest.Mock;
  let organisationFind: jest.Mock;

  /** Injecte une position dans le cache interne comme le ferait un flux Libellule/Traccar. */
  const seed = (organisationId: string, carId: string, plateNumber: string) => {
    const cache: Map<string, LiveCarPosition> = (service as any).latestCarGps;
    const key: string = (service as any).gpsKey(organisationId, carId);
    cache.set(key, {
      organisationId,
      carId,
      plateNumber,
      lat: 5.35,
      lng: -4.0,
      time: new Date().toISOString(),
    });
  };

  beforeEach(() => {
    centralQuery = jest.fn();
    organisationFind = jest.fn();

    service = new HardwareStreamService(
      { find: organisationFind } as any,
      { query: centralQuery } as any,
      { get: (_k: string, d?: any) => d } as any,
      {} as any,
      { emit: jest.fn() } as any,
    );
  });

  describe('getLiveLocations', () => {
    it("renvoie TOUS les bus de l'école qui interroge, et rien qu'eux", () => {
      // Une école exploite plusieurs cars : ils doivent tous remonter.
      seed(ORG_A, 'car-a1', 'AA-001');
      seed(ORG_A, 'car-a2', 'AA-002');
      seed(ORG_A, 'car-a3', 'AA-003');
      seed(ORG_B, 'car-b1', 'BB-001');
      seed(ORG_B, 'car-b2', 'BB-002');

      const vuParA = service.getLiveLocations(ORG_A);

      expect(vuParA).toHaveLength(3);
      expect(vuParA.map((p) => p.plateNumber).sort()).toEqual(['AA-001', 'AA-002', 'AA-003']);
      expect(vuParA.every((p) => p.organisationId === ORG_A)).toBe(true);

      // Et symétriquement pour B, qui a sa propre flotte.
      expect(service.getLiveLocations(ORG_B).map((p) => p.plateNumber).sort()).toEqual([
        'BB-001',
        'BB-002',
      ]);
    });

    it("ne laisse fuir aucun bus de l'autre école", () => {
      seed(ORG_A, 'car-a1', 'AA-001');
      seed(ORG_B, 'car-b1', 'BB-001');
      seed(ORG_B, 'car-b2', 'BB-002');

      const vuParA = service.getLiveLocations(ORG_A);
      const platesB = ['BB-001', 'BB-002'];

      expect(vuParA.some((p) => platesB.includes(p.plateNumber as string))).toBe(false);
    });

    it('renvoie une liste vide, et non tout le parc, si aucune école est fournie', () => {
      seed(ORG_A, 'car-a1', 'AA-001');
      seed(ORG_B, 'car-b1', 'BB-001');

      expect(service.getLiveLocations('')).toEqual([]);
      expect(service.getLiveLocations(undefined as any)).toEqual([]);
    });

    it("renvoie une liste vide pour une école qui n'a aucun bus en ligne", () => {
      seed(ORG_B, 'car-b1', 'BB-001');

      expect(service.getLiveLocations(ORG_A)).toEqual([]);
    });

    it('sépare deux bus portant le même identifiant dans deux écoles différentes', () => {
      // Les bases étant distinctes, rien n'interdit un même id de véhicule des deux côtés.
      seed(ORG_A, 'car-partage', 'AA-001');
      seed(ORG_B, 'car-partage', 'BB-001');

      expect(service.getLiveLocations(ORG_A).map((p) => p.plateNumber)).toEqual(['AA-001']);
      expect(service.getLiveLocations(ORG_B).map((p) => p.plateNumber)).toEqual(['BB-001']);
    });
  });

  describe('resolveTenantForDevice', () => {
    const resolve = (deviceId: string) =>
      (service as any).resolveTenantForDevice(deviceId);

    it("rattache l'appareil à l'école qui l'a appairé", async () => {
      centralQuery.mockResolvedValue([
        { organisationId: ORG_B, name: 'École B', dbName: 'db_b', dbProvisioned: true },
      ]);

      await expect(resolve('GPS-123')).resolves.toEqual({
        state: 'assigned',
        tenant: expect.objectContaining({ organisationId: ORG_B }),
      });
    });

    it("laisse en attente une balise non appairée, sans l'attribuer à une école", async () => {
      centralQuery.mockResolvedValue([]);
      organisationFind.mockResolvedValue([{ id: ORG_A, name: 'École A' }]);

      await expect(resolve('GPS-NEUVE')).resolves.toEqual({ state: 'pending' });
      // Le repli « première organisation trouvée » ne doit plus exister.
      expect(organisationFind).not.toHaveBeenCalled();
    });

    it("propage une panne de base centrale au lieu de la faire passer pour une attente", async () => {
      centralQuery.mockRejectedValue(new Error('connexion perdue'));

      await expect(resolve('GPS-123')).rejects.toThrow('connexion perdue');
    });
  });

  describe("appareil en attente d'affectation", () => {
    it("inscrit une balise inconnue en stock et n'écrit dans aucune base école", async () => {
      // Aucun appareil connu, aucune affectation.
      centralQuery.mockResolvedValue([]);
      const getTenantDataSource = jest
        .spyOn(service as any, 'getTenantDataSource')
        .mockResolvedValue({} as any);

      const res = await service.handleTraccarStream({
        uniqueId: 'GPS-NEUVE',
        latitude: 5.31,
        longitude: -4.01,
      });

      expect(res).toMatchObject({ success: true, pending: true });
      // Aucune connexion à une base école n'a été ouverte.
      expect(getTenantDataSource).not.toHaveBeenCalled();
      // L'appareil a bien été inscrit à l'inventaire central.
      const inserts = centralQuery.mock.calls.filter(([sql]) =>
        String(sql).includes('INSERT INTO devices'),
      );
      expect(inserts).toHaveLength(1);
      expect(inserts[0][1]).toEqual(['GPS', 'GPS-NEUVE']);
    });

    it("ne publie aucune position tant que la balise n'a pas d'école", async () => {
      centralQuery.mockResolvedValue([]);
      jest.spyOn(service as any, 'getTenantDataSource').mockResolvedValue({} as any);

      await service.handleTraccarStream({
        uniqueId: 'GPS-NEUVE',
        latitude: 5.31,
        longitude: -4.01,
      });

      expect(service.getLiveLocations(ORG_A)).toEqual([]);
      expect(service.getLiveLocations(ORG_B)).toEqual([]);
    });
  });

  describe('HardwareStreamController', () => {
    let controller: HardwareStreamController;
    let getLiveLocations: jest.Mock;

    beforeEach(() => {
      getLiveLocations = jest.fn().mockReturnValue([]);
      controller = new HardwareStreamController({ getLiveLocations } as any);
    });

    it("interroge le service avec l'école du JWT, pas avec un paramètre client", () => {
      controller.getLiveLocations({ organisationId: ORG_A });

      expect(getLiveLocations).toHaveBeenCalledWith(ORG_A);
      expect(getLiveLocations).toHaveBeenCalledTimes(1);
    });

    it("refuse un compte sans école plutôt que de tout renvoyer", () => {
      expect(() => controller.getLiveLocations({})).toThrow(ForbiddenException);
      expect(() => controller.getLiveLocations(undefined as any)).toThrow(ForbiddenException);
      expect(getLiveLocations).not.toHaveBeenCalled();
    });
  });
});
