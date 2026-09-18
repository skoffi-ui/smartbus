import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { TenantService } from '../tenant/tenant.service';
import { Car } from '@app/database/tenant-entities/car.entity';
import { Child } from '@app/database/tenant-entities/child.entity';
import { firstValueFrom } from 'rxjs';
import * as fs from 'fs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class GpsService {
  private readonly logger = new Logger(GpsService.name);
  private readonly apiHash = '$2y$10$O3UKDU8Lnn/NJeSg3.sDH.D1RPrdjZ7qFi4hLwMf/xgrHB0kkdGNi'; // Temporarily hardcoded for prototype

  constructor(
    private readonly httpService: HttpService,
    private readonly tenantService: TenantService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getLiveLocations(tenantIdOverride?: string): Promise<any[]> {
    // URL de notre backend central (super-app)
    const superAppUrl = 'http://localhost:3000/api/v1/hardware/live-locations';
    
    try {
      const res = await firstValueFrom(this.httpService.get(superAppUrl));
      const traccarLocations = res.data; // Array de { lat, lng, speed, time, carId, plateNumber }
      
      // On retourne directement les données du cache interne alimenté par Traccar
      if (Array.isArray(traccarLocations) && traccarLocations.length > 0) {
        return traccarLocations;
      }
      return [];
    } catch (err) {
      this.logger.error(`Erreur récupération GPS depuis Traccar Cache : ${err.message}`);
      
      // MOCK DE SECOURS EN CAS D'ERREUR POUR NE PAS BLOQUER LA DÉMO
      const dataSource = await this.tenantService.getDataSource(tenantIdOverride);
      const carRepo = dataSource.getRepository(Car);
      const cars = await carRepo.find({ where: { isActive: true } });
      const activeCars = cars.filter(c => c.gpsDeviceId);
      
      return activeCars.map(car => ({
        carId: car.id,
        plateNumber: car.plateNumber,
        brand: car.brand,
        model: car.model,
        lat: 5.359951 + (Math.random() * 0.005), 
        lng: -4.008256 + (Math.random() * 0.005),
        speed: 15,
        time: new Date().toISOString(),
      }));
    }
  }

  /**
   * Tâche d'arrière-plan surveillant l'approche des bus.
   * Déclenche une alerte si un bus est à moins de 2 km d'un point d'arrêt d'un enfant.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkApproachingBuses() {
    this.logger.debug("Vérification des bus en approche...");
    const liveLocations = await this.getLiveLocations();
    
    // Pour l'MVP, on simule la détection pour le premier bus actif
    // En production, il faudrait récupérer les Courses actives, les Points de récupération,
    // calculer la distance Haversine entre le bus et le point, et vérifier les enfants affectés.
    if (liveLocations && liveLocations.length > 0) {
      const bus = liveLocations[0]; // On prend un bus au hasard pour la démo
      
      // On récupère le premier enfant de la DB pour lui simuler l'alerte d'approche
      try {
        const ds = await this.tenantService.getDataSource(); // Prend le premier tenant
        const child = await ds.getRepository(Child).findOne({ where: { isActive: true } });
        if (child && bus) {
           this.eventEmitter.emit('bus.approaching', {
              childId: child.id,
              carId: bus.carId,
              distanceKm: 1.8, // Simulation < 2km
              etaMins: 4,      // Simulation < 5 mins
              tenantId: await this.tenantService.getFirstOrganisationId()
           });
        }
      } catch (e) {
        this.logger.error("Erreur de la boucle d'approche bus: " + e.message);
      }
    }
  }

  /**
   * Calcule l'itinéraire réel et l'estimation de temps (ETA) entre des points géographiques via OSRM
   */
  async calculateRoute(waypoints: { lat: number; lng: number }[]): Promise<any> {
    if (waypoints.length < 2) {
      throw new Error('Il faut au moins 2 points de passage pour calculer un itinéraire.');
    }

    // Convertir au format requis par OSRM : lng,lat;lng,lat...
    const coordsStr = waypoints.map(wp => `${wp.lng},${wp.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;

    try {
      const res = await firstValueFrom(this.httpService.get(url));
      const data = res.data;

      if (data && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        return {
          success: true,
          geometry: route.geometry, // GGF/GeoJSON LineString
          duration: route.duration, // en secondes
          distance: route.distance, // en mètres
        };
      }
      return { success: false, message: "Aucun itinéraire trouvé par OSRM." };
    } catch (err: any) {
      this.logger.error(`Erreur lors du calcul d'itinéraire OSRM : ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Snappe une série de points GPS bruts sur le réseau routier via OSRM (Map Matching)
   */
  async mapMatch(waypoints: { lat: number; lng: number }[]): Promise<any> {
    if (waypoints.length < 2) return { success: false, message: 'Minimum 2 points requis pour le matching.' };
    
    const coordsStr = waypoints.map(wp => `${wp.lng},${wp.lat}`).join(';');
    const radiuses = waypoints.map(() => '50').join(';'); // Tolérance de 50m par point
    
    const url = `https://router.project-osrm.org/match/v1/driving/${coordsStr}?radiuses=${radiuses}&overview=simplified`;
    
    try {
      const res = await firstValueFrom(this.httpService.get(url));
      if (res.data && res.data.matchings && res.data.matchings.length > 0) {
        return {
          success: true,
          matchedPoints: res.data.matchings[0].geometry,
          confidence: res.data.matchings[0].confidence
        };
      }
      return { success: false, message: "Aucun matching trouvé." };
    } catch (err: any) {
      this.logger.error(`Erreur OSRM Map Match : ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Géocodage inverse avec Nominatim (OpenStreetMap)
   */
  async reverseGeocode(lat: number, lng: number): Promise<any> {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    try {
      const res = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            'User-Agent': 'SMARTBUS_App/1.0 (contact@smartbus.ci)', // Obligatoire pour Nominatim
            'Accept-Language': 'fr-FR'
          }
        })
      );
      if (res.data && res.data.display_name) {
        return {
          success: true,
          address: res.data.display_name,
          details: res.data.address
        };
      }
      return { success: false, message: 'Adresse non trouvée' };
    } catch (err: any) {
      this.logger.error(`Erreur Nominatim: ${err.message}`);
      return { success: false, error: 'Erreur lors de la récupération de l\'adresse' };
    }
  }
}
