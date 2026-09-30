import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';
import { HardwareStreamService } from '../hardware-stream/hardware-stream.service';

/** Position d'un véhicule, normalisée depuis la réponse groupée de GPSWOX. */
export interface GpswoxDevicePosition {
  /** Identifiant GPSWOX de l'appareil (`item.id`) — pas l'IMEI, qui n'est pas
   * garanti présent dans la réponse de `/api/get_devices`. Utilisé comme clé
   * de pairage central (voir `Car.gpsDeviceId`, à renseigner par l'école). */
  externalId: string;
  name?: string;
  lat: number;
  lng: number;
  speed: number;
  online?: string;
  time?: string;
  address?: string;
}

/**
 * Nombre maximum de véhicules retenus par cycle. Vérifié sur le vrai parc du
 * client (29 appareils au total) : le fournir en dur ici plutôt qu'en config
 * suffit largement, avec de la marge, pour un parc qui reste sous cette
 * taille — à revoir seulement si le parc dépassait franchement la trentaine.
 */
const MAX_VEHICULES_PAR_CYCLE = 30;

/**
 * « Allumé ou en déplacement », d'après ce que ce déploiement GPSWOX renvoie
 * réellement (vérifié en direct) :
 * - `engine_status` est TOUJOURS `null` ici, quel que soit l'appareil — donc
 *   inutilisable pour détecter le contact mis.
 * - `online` vaut `"offline"` (jamais connecté ou signal perdu — coordonnées
 *   à 0,0, déjà exclues plus haut), `"ack"` (connecté, dernière position
 *   connue mais actuellement à l'arrêt) ou `"online"` (connecté et suivi
 *   actif). C'est le seul signal fiable de « l'appareil est sous tension et
 *   reporte », donc de « allumé ».
 * - `speed > 0` capture le cas où l'appareil est déjà en mouvement.
 *
 * Un appareil `"offline"` mais avec une vitesse positive (cas limite,
 * jamais vu sur ce parc) reste inclus par la deuxième condition — mieux
 * vaut l'afficher que le perdre sur un mauvais classement de statut.
 */
function estAllumeOuEnDeplacement(item: GpswoxDevicePosition): boolean {
  return item.online !== 'offline' || item.speed > 0;
}

/**
 * Interroge le serveur GPSWOX central pour la position de tous les véhicules
 * du parc, et alimente le même canal de suivi live que les webhooks
 * Libellule/Traccar (voir `HardwareStreamService.ingestGpsPosition`).
 *
 * GPSWOX est une API de type *pull* : contrairement à Libellule/Traccar (qui
 * nous poussent leurs positions via webhook), rien n'arrive tout seul ici —
 * c'est nous qui devons l'interroger périodiquement. D'où ce planificateur,
 * plutôt qu'un nouvel endpoint côté `HardwareStreamController`.
 */
@Injectable()
export class GpswoxService {
  private readonly logger = new Logger(GpswoxService.name);
  private readonly baseUrl: string;
  private readonly email: string;
  private readonly password: string;
  private readonly apiHash: string;
  /** Empêche un cycle de recouvrir le précédent si le serveur répond lentement. */
  private enCours = false;
  /** Suivi de santé du sondage — voir `getSante()`, affiché sur « Véhicules GPS ». */
  private echecsConsecutifs = 0;
  private dernierSuccesA: Date | null = null;
  /** 3 cycles d'affilée (~1 minute) avant de considérer le sondage réellement en panne. */
  private static readonly SEUIL_ECHECS_PANNE = 3;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly hardwareStreamService: HardwareStreamService,
  ) {
    // Valeurs par défaut vides plutôt que `getOrThrow` : tant que les
    // identifiants réels ne sont pas fournis, le planificateur ne doit pas
    // empêcher super-app de démarrer — il se contente de ne rien faire (voir
    // `pollDevices`), même principe que `BiotimeCentralService`. Ces quatre
    // valeurs ne vivent QUE dans `.env` (jamais commité, voir .gitignore),
    // jamais en dur dans ce fichier ni dans aucun message/log.
    this.baseUrl = this.configService
      .get<string>('GPSWOX_BASE_URL', '')
      .replace(/\/+$/, '');
    this.email = this.configService.get<string>('GPSWOX_EMAIL', '');
    this.password = this.configService.get<string>('GPSWOX_PASSWORD', '');
    this.apiHash = this.configService.get<string>('GPSWOX_API_HASH', '');
  }

  private get configured(): boolean {
    return Boolean(this.baseUrl && this.email && this.password && this.apiHash);
  }

  /**
   * Une page de la réponse GPSWOX, aplatie (les groupes ne sont qu'une
   * catégorisation d'affichage côté GPSWOX, sans intérêt ici).
   */
  private async fetchPage(page: number, limit: number): Promise<any[]> {
    const res = await firstValueFrom(
      this.httpService.get(`${this.baseUrl}/api/get_devices`, {
        // Ce déploiement GPSWOX exige `email`/`password` en plus du
        // `user_api_hash` documenté — passés via `params` (axios les
        // sérialise lui-même dans l'URL), jamais concaténés à la main dans
        // une chaîne qui pourrait finir dans un message de log ou d'erreur.
        params: {
          lang: 'fr',
          email: this.email,
          password: this.password,
          user_api_hash: this.apiHash,
          limit,
          page,
        },
        timeout: 15000,
      }),
    );
    const groupes: any[] = Array.isArray(res.data) ? res.data : [];
    return groupes.flatMap((g) => g?.items || []);
  }

  /**
   * Récupère la liste complète des véhicules depuis GPSWOX, en paginant.
   *
   * `limit` vaut 100 par défaut côté GPSWOX (documenté) : sans le préciser
   * explicitement ET sans boucler sur `page`, un parc qui dépasserait 100
   * appareils verrait les suivants silencieusement absents de la réponse —
   * aucune erreur, juste des véhicules manquants sur la carte. Le parc
   * actuel (29 appareils) ne le révèle jamais en pratique, mais la pagination
   * documentée existe précisément pour ce cas : elle est donc bouclée ici
   * plutôt que supposée inutile.
   */
  private async fetchAllItems(): Promise<any[]> {
    const LIMITE_PAR_PAGE = 100; // maximum documenté par GPSWOX
    const GARDE_FOU_PAGES = 20; // 2000 appareils : largement au-delà de tout parc réaliste ici
    const tous: any[] = [];
    let page = 1;

    while (page <= GARDE_FOU_PAGES) {
      const items = await this.fetchPage(page, LIMITE_PAR_PAGE);
      tous.push(...items);
      if (items.length < LIMITE_PAR_PAGE) break; // dernière page atteinte
      page++;
    }

    return tous;
  }

  /**
   * Récupère et normalise la liste des véhicules depuis GPSWOX. Un appareil
   * sans coordonnées exploitables (souvent : jamais connecté) est ignoré
   * plutôt que diffusé avec `lat`/`lng` à 0 — afficher un bus au large du
   * golfe de Guinée serait pire que ne rien afficher.
   *
   * Le filtrage serveur (`status=`, `online=`) documenté par GPSWOX a été
   * testé en direct sur ce déploiement et s'est avéré peu fiable pour notre
   * besoin (`status=online,ack` renvoyait TOUT le parc, y compris les
   * appareils `offline` — les valeurs acceptées par ce paramètre ne
   * correspondent visiblement pas à celles du champ `online` de la réponse).
   * Le filtrage reste donc fait ici, côté client, sur des champs dont le
   * comportement réel a été vérifié (voir `estAllumeOuEnDeplacement`).
   */
  async fetchDevices(): Promise<GpswoxDevicePosition[]> {
    if (!this.configured) return [];

    try {
      const items = await this.fetchAllItems();
      const positions: GpswoxDevicePosition[] = [];

      for (const item of items) {
        const lat = Number(item?.lat);
        const lng = Number(item?.lng);
        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lng) ||
          (lat === 0 && lng === 0)
        )
          continue;
        if (item?.id === undefined || item?.id === null) continue;

        positions.push({
          externalId: String(item.id),
          name: item.name,
          lat,
          lng,
          speed: Number(item.speed) || 0,
          online: item.online,
          // `item.time` est une chaîne humaine (`"27-09-2026 20:14:34"`, jour
          // avant mois) que `new Date()` ne sait pas parser — vérifié en
          // direct, ça donne "Invalid Date" partout où c'est affiché.
          // `item.timestamp` (epoch secondes) représente le même instant
          // (recoupé en direct : quelques secondes d'écart, horloge serveur
          // vs appareil) et EST documenté pour cet usage.
          time:
            Number(item.timestamp) > 0
              ? new Date(Number(item.timestamp) * 1000).toISOString()
              : undefined,
          address: item.address,
        });
      }

      // Ne garder que les véhicules allumés/en déplacement (voir
      // `estAllumeOuEnDeplacement`) — un véhicule éteint depuis des jours
      // n'a rien à faire sur la carte /live. Les plus rapides d'abord :
      // en cas de dépassement de `MAX_VEHICULES_PAR_CYCLE`, ce sont les
      // véhicules réellement en route qu'on veut garder en priorité, pas
      // un tri arbitraire.
      const actifs = positions
        .filter(estAllumeOuEnDeplacement)
        .sort((a, b) => b.speed - a.speed)
        .slice(0, MAX_VEHICULES_PAR_CYCLE);

      // Succès même si `actifs` est vide (parc réellement inactif en ce
      // moment) : seule une exception ci-dessous compte comme un échec de
      // SONDAGE — ne pas les confondre, sous peine de fausses alertes de
      // panne dès que plus aucun véhicule ne roule.
      this.echecsConsecutifs = 0;
      this.dernierSuccesA = new Date();

      return actifs;
    } catch (err: any) {
      // Un serveur injoignable ne doit jamais faire planter super-app, ni
      // faire disparaître silencieusement les positions déjà connues des
      // écoles : on journalise et on réessaiera au prochain cycle.
      //
      // Volontairement `err.message` UNIQUEMENT (ex: "Request failed with
      // status code 401") — jamais `err.config` ni `err.request`, qui
      // contiennent l'URL complète avec email/mot de passe/hash en clair
      // dans la query string. Ne pas élargir ce log sans y repenser.
      this.echecsConsecutifs++;
      this.logger.error(
        `[GPSWOX] Récupération des véhicules impossible : ${err.message}`,
      );
      return [];
    }
  }

  /**
   * Santé du sondage GPSWOX, pour affichage Super Admin (« Véhicules GPS »).
   * Avant ça, un GPSWOX injoignable ne se voyait que dans les logs — rien ne
   * prévenait qu'aucune position ne se mettait plus à jour depuis un moment.
   */
  getSante(): {
    configured: boolean;
    dernierSuccesA: Date | null;
    echecsConsecutifs: number;
    enPanne: boolean;
  } {
    return {
      configured: this.configured,
      dernierSuccesA: this.dernierSuccesA,
      echecsConsecutifs: this.echecsConsecutifs,
      enPanne:
        this.configured &&
        this.echecsConsecutifs >= GpswoxService.SEUIL_ECHECS_PANNE,
    };
  }

  /**
   * Cycle de sondage, toutes les 20 secondes. Chaque position est déléguée à
   * `HardwareStreamService.ingestGpsPosition`, qui résout l'école
   * propriétaire (via l'inventaire central `devices`/`organisation_devices`)
   * puis le véhicule précis (via `Car.gpsDeviceId`) avant de diffuser — voir
   * la page Super Admin « Véhicules GPS » pour l'assignation école↔appareil,
   * et l'onglet « Périphérique GPS » de Cars.tsx pour l'assignation
   * appareil↔bus.
   */
  @Cron('*/20 * * * * *')
  async pollDevices(): Promise<void> {
    if (!this.configured || this.enCours) return;
    this.enCours = true;

    try {
      const positions = await this.fetchDevices();
      if (positions.length === 0) return;

      for (const position of positions) {
        try {
          await this.hardwareStreamService.ingestGpsPosition({
            deviceId: position.externalId,
            lat: position.lat,
            lng: position.lng,
            speed: position.speed,
            time: position.time,
            online: position.online,
          });
        } catch (err: any) {
          this.logger.error(
            `[GPSWOX] Ingestion de la position de l'appareil ${position.externalId} échouée : ${err.message}`,
          );
        }
      }
    } finally {
      this.enCours = false;
    }
  }
}
