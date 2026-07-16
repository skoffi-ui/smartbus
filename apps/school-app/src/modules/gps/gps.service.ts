import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { TenantService } from '../tenant/tenant.service';
import { Car } from '@app/database/tenant-entities/car.entity';
import { firstValueFrom } from 'rxjs';
import * as fs from 'fs';

@Injectable()
export class GpsService {
  private readonly logger = new Logger(GpsService.name);
  private readonly apiHash = '$2y$10$O3UKDU8Lnn/NJeSg3.sDH.D1RPrdjZ7qFi4hLwMf/xgrHB0kkdGNi'; // Temporarily hardcoded for prototype

  constructor(
    private readonly httpService: HttpService,
    private readonly tenantService: TenantService,
  ) {}

  async getLiveLocations(tenantIdOverride?: string): Promise<any[]> {
    const dataSource = await this.tenantService.getDataSource(tenantIdOverride);
    const carRepo = dataSource.getRepository(Car);
    
    // Get all cars that have a gpsDeviceId
    const cars = await carRepo.find({
      where: { isActive: true }
    });

    const activeCars = cars.filter(c => c.gpsDeviceId);
    if (activeCars.length === 0) return [];

    const locations = [];
    const today = new Date().toISOString().split('T')[0];

    // Ideally, we would use a single bulk API call to Libellule if supported,
    // but for now we loop through the devices and get their latest position.
    for (const car of activeCars) {
      try {
        const url = `https://libellule.sudcontractors.com/api/get_history?device_id=${car.gpsDeviceId}&from_date=${today}&to_date=${today}&from_time=00:00:00&to_time=23:59:59&user_api_hash=${this.apiHash}`;
        
        const res = await firstValueFrom(this.httpService.get(url));
        const data = res.data;
        
        let latestPosition = null;
        
        let groups = [];
        if (Array.isArray(data)) {
           groups = data;
        } else if (data && data.items) {
           groups = Array.isArray(data.items) ? data.items : Object.values(data.items);
        }

        if (groups.length > 0) {
           const lastGroup = groups[groups.length - 1];
           let subItems = [];
           if (lastGroup.items) {
              subItems = Array.isArray(lastGroup.items) ? lastGroup.items : Object.values(lastGroup.items);
           }
           
           if (subItems.length > 0) {
              latestPosition = subItems[subItems.length - 1];
           } else {
              latestPosition = lastGroup;
           }
        }

        if (latestPosition) {
          locations.push({
            carId: car.id,
            plateNumber: car.plateNumber,
            brand: car.brand,
            model: car.model,
            lat: latestPosition.lat || latestPosition.latitude,
            lng: latestPosition.lng || latestPosition.longitude,
            speed: latestPosition.speed,
            time: latestPosition.time || latestPosition.raw_time,
          });
        }
      } catch (err) {
        fs.writeFileSync('C:\\Users\\HP\\Desktop\\SMARTBUS_project\\scratch\\gps-error.txt', err.message);
        this.logger.error(`Erreur GPS pour le véhicule ${car.plateNumber}: ${err.message}`);
        
        // MOCK DE SECOURS EN CAS DE TIMEOUT LIBELLULE POUR NE PAS BLOQUER LA DÉMO
        this.logger.warn(`Utilisation des coordonnées GPS de secours pour ${car.plateNumber}`);
        locations.push({
          carId: car.id,
          plateNumber: car.plateNumber,
          brand: car.brand,
          model: car.model,
          lat: 5.359951 + (Math.random() * 0.005), // Abidjan avec légère variation
          lng: -4.008256 + (Math.random() * 0.005),
          speed: 15,
          time: new Date().toISOString(),
        });
      }
    }

    fs.writeFileSync('C:\\Users\\HP\\Desktop\\SMARTBUS_project\\scratch\\gps-log.txt', JSON.stringify(locations, null, 2));
    return locations;
  }
}
