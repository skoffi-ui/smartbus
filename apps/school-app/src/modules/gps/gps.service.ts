import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
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
  constructor(
    private readonly httpService: HttpService,
    private readonly tenantService: TenantService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Positions en direct des bus de l'école appelante.
   *
   * Le jeton de l'utilisateur est relayé tel quel à la super-app, qui en déduit
   * l'école et ne renvoie que SES véhicules. La chaîne d'identité est ainsi
   * préservée de bout en bout : school-app n'a jamais à être crue sur parole.
   */
  async getLiveLocations(accessToken: string): Promise<any[]> {
    const superAppUrl = `${this.configService.get<string>(
      'SUPER_APP_URL',
      'http://localhost:3000',
    )}/api/v1/hardware/live-locations`;

    try {
      const res = await firstValueFrom(
        this.httpService.get(superAppUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      );
      return Array.isArray(res.data) ? res.data : [];
    } catch (err: any) {
      // Aucune position de repli : fabriquer des coordonnées rendrait « le suivi est
      // en panne » indiscernable de « le bus roule ». Sur un produit de sécurité
      // enfant, un bus fantôme est plus dangereux qu'une absence de position.
      const status = err?.response?.status;
      this.logger.error(
        `Positions GPS indisponibles (super-app ${status ?? 'injoignable'}) : ${err.message}`,
      );
      throw new ServiceUnavailableException(
        'Positions GPS momentanément indisponibles.',
      );
    }
  }

  /**
   * DÉSACTIVÉ — ne pas réactiver en l'état.
   *
   * Cette tâche était une maquette de démonstration : elle prenait le premier bus
   * rencontré, le premier enfant de la première école, et émettait `bus.approaching`
   * avec une distance (1,8 km) et un ETA (4 min) codés en dur — chaque minute. Ces
   * événements alimentent les notifications aux parents : en production, c'était un
   * générateur de fausses alertes de proximité, sans lien avec la position réelle.
   *
   * Une implémentation correcte appartient à la super-app, là où réside le cache des
   * positions : parcourir les courses actives de chaque école, calculer la distance
   * Haversine entre le bus et chaque point de récupération du trajet, et n'alerter
   * que les parents des enfants réellement affectés à ce point — une seule fois par
   * course et par enfant.
   */
  // @Cron(CronExpression.EVERY_MINUTE)  ← volontairement non planifié
  async checkApproachingBuses(): Promise<void> {
    this.logger.warn(
      "checkApproachingBuses est désactivé : maquette de démonstration, à réécrire côté super-app.",
    );
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
