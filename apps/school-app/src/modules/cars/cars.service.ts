import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Car } from '@app/database';
import { CreateCarDto, UpdateCarDto } from './dto/cars.dto';
import { TenantService } from '../tenant/tenant.service';

@Injectable()
export class CarsService {
  constructor(private readonly tenantService: TenantService) {}

  private async getRepo(): Promise<Repository<Car>> {
    const dataSource = await this.tenantService.getDataSource();
    return dataSource.getRepository(Car);
  }

  async findAll(): Promise<Car[]> {
    const repo = await this.getRepo();
    return repo.find({ order: { createdAt: 'DESC' } });
  }

  /**
   * Appareils alloués à cette école, lus dans l'inventaire central.
   *
   * La requête sélectionnait `d.model`, colonne qui n'existe que sur la table
   * `devices` des bases école, pas sur celle de la base centrale interrogée ici :
   * l'endpoint répondait donc systématiquement 500.
   *
   * Deux pairages centraux distincts et sans rapport entre eux, historiquement :
   * - GPS (GPSWOX, Traccar, Libellule…) : table générique `devices`/
   *   `organisation_devices` (voir `DevicesController`/`VehiculesGps.tsx`).
   * - Badgeuses BioTime : leur propre table `biotime_terminals`, assignée
   *   directement par `organisation_id` (voir « Gestion BioTime Centralisée »,
   *   `BiotimeAdminController`) — jamais écrite dans `devices`/
   *   `organisation_devices`, malgré `type_device` y prévoyant déjà la
   *   valeur `'BADGEUSE'`. Sans ce deuxième bloc, le menu « Badgeuse associée »
   *   de Cars.tsx restait toujours vide, quelle que soit l'assignation faite
   *   côté Super Admin : aucune badgeuse n'atterrit jamais dans la première table.
   *
   * Chaque appareil est en plus annoté de `assignedCarId`/`assignedCarPlate`
   * s'il est déjà utilisé par un véhicule de CETTE école (table `cars`, dans
   * la base tenant — distincte des tables centrales interrogées ci-dessus,
   * d'où la fusion manuelle plutôt qu'une jointure SQL). Cars.tsx s'en sert
   * pour griser un appareil déjà pris dans son menu, au lieu de laisser
   * `assertAppareilLibre` être la seule ligne de défense, découverte
   * seulement à la sauvegarde.
   */
  async getAllocatedDevices(): Promise<any[]> {
    const orgId = this.tenantService.getTenantId();
    if (!orgId) return [];

    const [genericDevices, terminaux, repo] = await Promise.all([
      this.tenantService.organisationRepository.query(
        `
          SELECT d.id, d.serial_number as "serialNumber", d.type_device as "typeDevice",
                 d.status, d.imei, d.last_seen_at as "lastSeenAt"
          FROM devices d
          INNER JOIN organisation_devices od ON od.device_id = d.id
          WHERE od.organisation_id = $1 AND od.released_at IS NULL AND d.deleted_at IS NULL
        `,
        [orgId],
      ),
      this.tenantService.organisationRepository.query(
        `
          SELECT id, serial_number as "serialNumber", 'BADGEUSE' as "typeDevice",
                 status, NULL as "imei", NULL as "lastSeenAt"
          FROM biotime_terminals
          WHERE organisation_id = $1
        `,
        [orgId],
      ),
      this.getRepo(),
    ]);

    const cars = await repo.find({
      select: { id: true, plateNumber: true, gpsDeviceId: true, biotimeTerminalSn: true },
    });
    const usageGps = new Map(cars.filter((c) => c.gpsDeviceId).map((c) => [c.gpsDeviceId, c]));
    const usageBadgeuse = new Map(cars.filter((c) => c.biotimeTerminalSn).map((c) => [c.biotimeTerminalSn, c]));

    const annoter = (d: any) => {
      const usage = d.typeDevice === 'GPS' ? usageGps.get(d.serialNumber) : usageBadgeuse.get(d.serialNumber);
      return {
        ...d,
        assignedCarId: usage?.id ?? null,
        assignedCarPlate: usage?.plateNumber ?? null,
      };
    };

    return [...genericDevices.map(annoter), ...terminaux.map(annoter)];
  }

  async findOne(id: string): Promise<Car> {
    const repo = await this.getRepo();
    const car = await repo.findOne({ where: { id } });
    if (!car) {
      throw new NotFoundException(`Véhicule ${id} introuvable dans cette école.`);
    }
    return car;
  }

  /**
   * Un même appareil (balise GPS ou badgeuse) ne doit jamais être associé à
   * deux véhicules à la fois : `ingestResolvedGpsPosition`/`processZktPunches`
   * retrouvent le véhicule par `gpsDeviceId`/`biotimeTerminalSn` avec un simple
   * `findOne` — sans cette règle, en cas de doublon, la position ou le
   * pointage d'un vrai véhicule pourrait silencieusement s'attribuer à
   * l'autre (lequel des deux gagne dépend de l'ordre de retour de la
   * requête, pas d'une règle métier). `excludeCarId` permet à un véhicule de
   * garder son propre appareil lors d'une modification.
   */
  private async assertAppareilLibre(
    champ: 'gpsDeviceId' | 'biotimeTerminalSn',
    valeur: string | undefined | null,
    excludeCarId?: string,
  ): Promise<void> {
    if (!valeur) return;
    const repo = await this.getRepo();
    const conflit = await repo.findOne({ where: { [champ]: valeur } as any });
    if (conflit && conflit.id !== excludeCarId) {
      const libelle = champ === 'gpsDeviceId' ? 'balise GPS' : 'badgeuse';
      throw new ConflictException(
        `Cette ${libelle} (${valeur}) est déjà associée au véhicule ${conflit.plateNumber}.`,
      );
    }
  }

  async create(createCarDto: CreateCarDto): Promise<Car> {
    const repo = await this.getRepo();
    const existing = await repo.findOne({ where: { plateNumber: createCarDto.plateNumber } });
    if (existing) {
      throw new ConflictException(`Le véhicule immatriculé ${createCarDto.plateNumber} existe déjà.`);
    }
    await this.assertAppareilLibre('gpsDeviceId', createCarDto.gpsDeviceId);
    await this.assertAppareilLibre('biotimeTerminalSn', createCarDto.biotimeTerminalSn);
    const car = repo.create(createCarDto);
    return repo.save(car);
  }

  async update(id: string, updateCarDto: UpdateCarDto): Promise<Car> {
    const repo = await this.getRepo();
    const car = await this.findOne(id);
    await this.assertAppareilLibre('gpsDeviceId', updateCarDto.gpsDeviceId, id);
    await this.assertAppareilLibre('biotimeTerminalSn', updateCarDto.biotimeTerminalSn, id);
    Object.assign(car, updateCarDto);
    return repo.save(car);
  }

  async remove(id: string): Promise<void> {
    const repo = await this.getRepo();
    const car = await this.findOne(id);
    await repo.remove(car);
  }

}
