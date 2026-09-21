import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Car } from '@app/database';
import { CreateCarDto, UpdateCarDto } from './dto/cars.dto';
import { TenantService } from '../tenant/tenant.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class CarsService {
  private readonly logger = new Logger(CarsService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly httpService: HttpService,
  ) {}

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
   */
  async getAllocatedDevices(): Promise<any[]> {
    const orgId = this.tenantService.getTenantId();
    if (!orgId) return [];

    const query = `
      SELECT d.id, d.serial_number as "serialNumber", d.type_device as "typeDevice",
             d.status, d.imei, d.last_seen_at as "lastSeenAt"
      FROM devices d
      INNER JOIN organisation_devices od ON od.device_id = d.id
      WHERE od.organisation_id = $1 AND od.released_at IS NULL AND d.deleted_at IS NULL
    `;
    const devices = await this.tenantService.organisationRepository.query(query, [orgId]);
    return devices;
  }

  async findOne(id: string): Promise<Car> {
    const repo = await this.getRepo();
    const car = await repo.findOne({ where: { id } });
    if (!car) {
      throw new NotFoundException(`Véhicule ${id} introuvable dans cette école.`);
    }
    return car;
  }

  async create(createCarDto: CreateCarDto): Promise<Car> {
    const repo = await this.getRepo();
    const existing = await repo.findOne({ where: { plateNumber: createCarDto.plateNumber } });
    if (existing) {
      throw new ConflictException(`Le véhicule immatriculé ${createCarDto.plateNumber} existe déjà.`);
    }
    const car = repo.create(createCarDto);
    return repo.save(car);
  }

  async update(id: string, updateCarDto: UpdateCarDto): Promise<Car> {
    const repo = await this.getRepo();
    const car = await this.findOne(id);
    Object.assign(car, updateCarDto);
    return repo.save(car);
  }

  async remove(id: string): Promise<void> {
    const repo = await this.getRepo();
    const car = await this.findOne(id);
    await repo.remove(car);
  }

  async syncFromLibellule(): Promise<{ synced: number }> {
    const hash = '$2y$10$O3UKDU8Lnn/NJeSg3.sDH.D1RPrdjZ7qFi4hLwMf/xgrHB0kkdGNi';
    const url = `https://libellule.sudcontractors.com/api/devices?user_api_hash=${hash}`;
    
    let devices: any[] = [];
    try {
      const response = await firstValueFrom(this.httpService.get(url));
      devices = response.data?.data || [];
    } catch (error) {
      this.logger.error(`Erreur lors de la récupération des véhicules depuis Libellule: ${error.message}`);
      throw new Error("Impossible de joindre l'API GPS");
    }

    const repo = await this.getRepo();
    let syncedCount = 0;

    for (const device of devices) {
      const gpsId = device.id?.toString();
      const name = device.name;
      if (!gpsId || !name) continue;

      // Check if a car with this GPS ID or plateNumber already exists
      const existing = await repo.findOne({
        where: [
          { gpsDeviceId: gpsId },
          { plateNumber: name }
        ]
      });

      if (!existing) {
        // Create new car
        const newCar = repo.create({
          plateNumber: name,
          brand: 'Inconnu',
          model: 'Inconnu',
          capacity: 30, // default capacity
          gpsDeviceId: gpsId,
          isActive: true
        });
        await repo.save(newCar);
        syncedCount++;
        this.logger.log(`Véhicule importé: ${name} (GPS ID: ${gpsId})`);
      } else if (!existing.gpsDeviceId) {
         // Update existing car that didn't have GPS ID
         existing.gpsDeviceId = gpsId;
         await repo.save(existing);
         syncedCount++;
         this.logger.log(`Véhicule mis à jour avec GPS ID: ${name}`);
      }
    }

    return { synced: syncedCount };
  }
}
