import { Injectable, Logger, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource, In } from 'typeorm';
import { SuperAppChild, SuperAppPunch, sensFromPunchState, SensPointage } from '@app/database';
import { firstValueFrom } from 'rxjs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BiotimeConfigService } from './biotime-config.service';

interface JetonEnCache {
  token: string;
  expireLe: Date;
}

/** Recouvrement appliqué à la fenêtre de synchronisation, pour absorber la dérive d'horloge. */
const RECOUVREMENT_MS = 5 * 60 * 1000;

/**
 * Lecture des serveurs BioTime des écoles.
 *
 * Chaque établissement héberge son propre serveur : toutes les opérations sont donc
 * paramétrées par `organisationId`. L'ancienne configuration globale (URL dans un
 * fichier sur disque, identifiants dans l'environnement) rendait impossible
 * l'accueil d'un deuxième client.
 */
@Injectable()
export class BiotimeService {
  private readonly logger = new Logger(BiotimeService.name);

  /** Un jeton par école : les serveurs sont distincts, les sessions aussi. */
  private readonly jetons = new Map<string, JetonEnCache>();

  /** Cache des départements BioTime par école. TTL = 10 min. Évite de refetcher à chaque push. */
  private readonly deptCache = new Map<string, { data: Map<string, number>; expireLe: Date }>();
  private static readonly DEPT_CACHE_TTL_MS = 10 * 60 * 1000;

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(SuperAppChild)
    private readonly childRepository: Repository<SuperAppChild>,
    @InjectRepository(SuperAppPunch)
    private readonly punchRepository: Repository<SuperAppPunch>,
    private readonly eventEmitter: EventEmitter2,
    private readonly centralDataSource: DataSource,
    private readonly configService: BiotimeConfigService,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // AUTHENTIFICATION AUPRÈS DU SERVEUR D'UNE ÉCOLE
  // ───────────────────────────────────────────────────────────────────────────

  async getAuthToken(organisationId: string): Promise<string> {
    const enCache = this.jetons.get(organisationId);
    if (enCache && enCache.expireLe > new Date()) {
      return enCache.token;
    }

    const { url, username, password } = await this.configService.obtenirIdentifiants(organisationId);

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${url}/jwt-api-token-auth/`,
          { username, password },
          { headers: { 'Content-Type': 'application/json' }, timeout: 15000 },
        ),
      );

      const token = response.data?.token;
      if (!token) {
        throw new Error('Aucun jeton dans la réponse du serveur BioTime.');
      }

      // Les jetons BioTime durent typiquement 24 h : on garde une marge.
      this.jetons.set(organisationId, {
        token,
        expireLe: new Date(Date.now() + 23 * 60 * 60 * 1000),
      });
      return token;
    } catch (error: any) {
      this.jetons.delete(organisationId);
      const message = error?.response?.status
        ? `HTTP ${error.response.status} depuis ${url}`
        : error.message;
      await this.configService.enregistrerEchec(organisationId, `Authentification : ${message}`);
      throw new HttpException(
        `Authentification BioTime impossible pour cette école : ${message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /** GET authentifié sur le serveur BioTime d'une école. */
  private async lire(organisationId: string, chemin: string): Promise<any> {
    const { url } = await this.configService.obtenirIdentifiants(organisationId);
    const token = await this.getAuthToken(organisationId);

    const appel = (jeton: string) =>
      firstValueFrom(
        this.httpService.get(`${url}${chemin}`, {
          headers: { 'Content-Type': 'application/json', Authorization: `JWT ${jeton}` },
          timeout: 30000,
        }),
      );

    try {
      const response = await appel(token);
      return response.data;
    } catch (error: any) {
      // Jeton périmé côté serveur : une seule nouvelle tentative après réauthentification.
      if (error?.response?.status === 401) {
        this.jetons.delete(organisationId);
        const response = await appel(await this.getAuthToken(organisationId));
        return response.data;
      }
      throw error;
    }
  }

  /** POST / PATCH / DELETE authentifié sur le serveur BioTime d'une école. */
  private async appelBiotime(
    organisationId: string,
    methode: 'post' | 'patch' | 'delete',
    chemin: string,
    donnees?: any,
  ): Promise<any> {
    const { url } = await this.configService.obtenirIdentifiants(organisationId);
    const token = await this.getAuthToken(organisationId);

    const envoyer = (jeton: string) => {
      const options = {
        headers: { 'Content-Type': 'application/json', Authorization: `JWT ${jeton}` },
        timeout: 30000,
      };
      const cible = `${url}${chemin}`;
      switch (methode) {
        case 'post':
          return firstValueFrom(this.httpService.post(cible, donnees, options));
        case 'patch':
          return firstValueFrom(this.httpService.patch(cible, donnees, options));
        case 'delete':
          return firstValueFrom(this.httpService.delete(cible, options));
      }
    };

    try {
      const response = await envoyer(token);
      return response.data;
    } catch (error: any) {
      if (error?.response?.status === 401) {
        this.jetons.delete(organisationId);
        const response = await envoyer(await this.getAuthToken(organisationId));
        return response.data;
      }
      throw error;
    }
  }

  /** Vérifie qu'une configuration répond, sans rien synchroniser. */
  async testerConnexion(organisationId: string): Promise<{ ok: boolean; message: string }> {
    try {
      const data = await this.lire(organisationId, '/personnel/api/employees/?page_size=1');
      const total = data?.count ?? 0;
      await this.configService.enregistrerSucces(organisationId, null, 0);
      return { ok: true, message: `Connexion établie. ${total} employé(s) visible(s) sur ce serveur.` };
    } catch (error: any) {
      const message = error?.response?.status
        ? `HTTP ${error.response.status}`
        : error.message || 'Serveur injoignable';
      await this.configService.enregistrerEchec(organisationId, message);
      return { ok: false, message };
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SYNCHRONISATION DES ENFANTS (ANNUAIRE)
  // ───────────────────────────────────────────────────────────────────────────

  async syncChildren(organisationId: string): Promise<any> {
    try {
      const data = await this.lire(organisationId, '/personnel/api/employees/?page_size=5000');
      const employes = data?.data;
      if (!Array.isArray(employes) || employes.length === 0) {
        return { message: 'Aucun employé trouvé sur ce serveur', count: 0 };
      }

      // Une seule lecture des enfants déjà connus de cette école.
      const existants = await this.childRepository.find({ where: { organisationId } });
      const parMatricule = new Map(existants.map((c) => [c.empCode, c]));

      const aEnregistrer: SuperAppChild[] = [];
      for (const emp of employes) {
        const champs = {
          organisationId,
          empCode: emp.emp_code,
          firstName: emp.first_name,
          lastName: emp.last_name,
          departmentId: emp.department ? emp.department.id?.toString() : undefined,
          departmentName: emp.department ? emp.department.dept_name : undefined,
          position: emp.position_name,
          hireDate: emp.hire_date ? new Date(emp.hire_date) : undefined,
          fingerprint: emp.fingerprint,
          areas: emp.area,
          photo: emp.photo,
          mobile: emp.mobile,
          contactTel: emp.contact_tel,
          email: emp.email,
        };

        const connu = parMatricule.get(emp.emp_code);
        aEnregistrer.push(
          connu
            ? (Object.assign(connu, champs) as SuperAppChild)
            : (this.childRepository.create(champs as Partial<SuperAppChild>) as SuperAppChild),
        );
      }

      await this.childRepository.save(aEnregistrer, { chunk: 200 });
      await this.configService.enregistrerSucces(organisationId, null, aEnregistrer.length);

      this.logger.log(
        `[BioTime] ${aEnregistrer.length} enfant(s) synchronisé(s) pour l'école ${organisationId}`,
      );
      return { message: 'Synchronisation des employés réussie', count: aEnregistrer.length };
    } catch (error: any) {
      const message = error?.response?.status ? `HTTP ${error.response.status}` : error.message;
      await this.configService.enregistrerEchec(organisationId, `Annuaire : ${message}`);
      this.logger.error(`[BioTime] Annuaire école ${organisationId} : ${message}`);
      throw new HttpException(
        `Synchronisation de l'annuaire impossible : ${message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ÉCRITURE VERS BIOTIME : EMPLOYÉS (PHASE 1)
  // ───────────────────────────────────────────────────────────────────────────

  async createEmployee(
    organisationId: string,
    donnees: { emp_code: string; first_name: string; last_name: string; department?: number; card_no?: string },
  ): Promise<any> {
    try {
      const resultat = await this.appelBiotime(
        organisationId, 'post', '/personnel/api/employees/', donnees,
      );
      this.logger.log(
        `[BioTime] Employé ${donnees.emp_code} créé sur le serveur de l'école ${organisationId}`,
      );
      return resultat;
    } catch (error: any) {
      const detail = error?.response?.data ?? error.message;
      this.logger.error(`[BioTime] Création employé échouée : ${JSON.stringify(detail)}`);
      throw new HttpException(
        { message: 'Création impossible sur BioTime', detail },
        error?.response?.status ?? HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async updateEmployee(
    organisationId: string,
    biotimeId: number,
    donnees: Record<string, any>,
  ): Promise<any> {
    try {
      const resultat = await this.appelBiotime(
        organisationId, 'patch', `/personnel/api/employees/${biotimeId}/`, donnees,
      );
      this.logger.log(
        `[BioTime] Employé #${biotimeId} mis à jour pour l'école ${organisationId}`,
      );
      return resultat;
    } catch (error: any) {
      const detail = error?.response?.data ?? error.message;
      this.logger.error(`[BioTime] Modification employé échouée : ${JSON.stringify(detail)}`);
      throw new HttpException(
        { message: 'Modification impossible sur BioTime', detail },
        error?.response?.status ?? HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async deleteEmployee(organisationId: string, biotimeId: number): Promise<void> {
    try {
      await this.appelBiotime(
        organisationId, 'delete', `/personnel/api/employees/${biotimeId}/`,
      );
      this.logger.log(
        `[BioTime] Employé #${biotimeId} supprimé du serveur de l'école ${organisationId}`,
      );
    } catch (error: any) {
      const detail = error?.response?.data ?? error.message;
      this.logger.error(`[BioTime] Suppression employé échouée : ${JSON.stringify(detail)}`);
      throw new HttpException(
        { message: 'Suppression impossible sur BioTime', detail },
        error?.response?.status ?? HttpStatus.BAD_GATEWAY,
      );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SYNCHRONISATION DES POINTAGES (INCRÉMENTALE)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Récupère les pointages parus depuis la dernière synchronisation de cette école.
   *
   * La fenêtre part du dernier passage, avec un recouvrement de quelques minutes
   * pour absorber la dérive d'horloge des badgeuses. La déduplication par
   * (école, identifiant BioTime) rend ce recouvrement inoffensif.
   *
   * L'ancienne version redemandait toute la journée à chaque passage et exécutait
   * trois requêtes SQL par pointage : le coût croissait tout au long de la journée.
   */
  async syncPunches(organisationId: string, depuisIso?: string): Promise<any> {
    const config = await this.configService.obtenirPublique(organisationId);
    if (!config) {
      throw new NotFoundException(`Aucun serveur BioTime configuré pour l'école ${organisationId}.`);
    }

    const debut = depuisIso
      ? new Date(depuisIso)
      : config.lastSyncedAt
        ? new Date(new Date(config.lastSyncedAt).getTime() - RECOUVREMENT_MS)
        : this.debutDeJournee();
    const fin = new Date();

    try {
      const data = await this.lire(
        organisationId,
        `/iclock/api/transactions/?start_time=${this.formatBiotime(debut)}` +
          `&end_time=${this.formatBiotime(fin)}&page_size=5000`,
      );

      const pointages = data?.data;
      if (!Array.isArray(pointages) || pointages.length === 0) {
        await this.configService.enregistrerSucces(organisationId, null, 0);
        return { message: 'Aucun nouveau pointage', count: 0 };
      }

      // Résolution en masse : un appel pour les enfants, un pour les doublons.
      const matricules = [...new Set(pointages.map((p: any) => p.emp_code).filter(Boolean))];
      const identifiants = pointages.map((p: any) => String(p.id)).filter(Boolean);

      const [enfants, dejaVus] = await Promise.all([
        matricules.length
          ? this.childRepository.find({ where: { organisationId, empCode: In(matricules) } })
          : Promise.resolve([]),
        identifiants.length
          ? this.punchRepository.find({
              where: { organisationId, biotimePunchId: In(identifiants) },
              select: { biotimePunchId: true },
            })
          : Promise.resolve([]),
      ]);

      const enfantParMatricule = new Map(enfants.map((c) => [c.empCode, c]));
      const identifiantsConnus = new Set(dejaVus.map((p) => p.biotimePunchId));

      const nouveaux: SuperAppPunch[] = [];
      const terminauxVus = new Set<string>();
      let sansEnfant = 0;
      let dernierId: string | null = config.lastSyncedPunchId;

      for (const p of pointages) {
        const identifiant = String(p.id);
        if (identifiantsConnus.has(identifiant)) continue;

        const enfant = enfantParMatricule.get(p.emp_code);
        if (!enfant) {
          sansEnfant++;
          continue;
        }

        if (p.terminal_sn) terminauxVus.add(p.terminal_sn);
        if (!dernierId || Number(identifiant) > Number(dernierId)) dernierId = identifiant;

        nouveaux.push(
          this.punchRepository.create({
            organisationId,
            biotimePunchId: identifiant,
            childId: enfant.id,
            empCode: p.emp_code,
            punchTime: new Date(p.punch_time),
            punchState: p.punch_state,
            verifyType: p.verify_type,
            terminalSn: p.terminal_sn,
          }),
        );
      }

      if (nouveaux.length) {
        await this.punchRepository.save(nouveaux, { chunk: 500 });
      }
      for (const sn of terminauxVus) {
        await this.autoRegisterDevice(sn);
      }

      await this.configService.enregistrerSucces(organisationId, dernierId, nouveaux.length);

      this.logger.log(
        `[BioTime] École ${organisationId} : ${nouveaux.length} nouveau(x) pointage(s)` +
          (sansEnfant ? `, ${sansEnfant} ignoré(s) faute d'enfant connu` : ''),
      );

      return {
        message: 'Synchronisation des pointages réussie',
        count: nouveaux.length,
        ignores: sansEnfant,
        fenetre: { debut: debut.toISOString(), fin: fin.toISOString() },
      };
    } catch (error: any) {
      const message = error?.response?.status ? `HTTP ${error.response.status}` : error.message;
      await this.configService.enregistrerEchec(organisationId, `Pointages : ${message}`);
      this.logger.error(`[BioTime] Pointages école ${organisationId} : ${message}`);
      throw new HttpException(
        `Synchronisation des pointages impossible : ${message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /** Synchronise toutes les écoles ayant une configuration active. Utilisé par le planificateur. */
  async syncToutesLesEcoles(): Promise<{ ecoles: number; total: number; erreurs: number }> {
    const configs = await this.configService.listerActives();
    let total = 0;
    let erreurs = 0;

    // Séquentiel volontairement : les serveurs BioTime sont des machines d'école,
    // souvent modestes, et rien n'exige la parallélisation à ce volume.
    for (const config of configs) {
      try {
        const resultat = await this.syncPunches(config.organisationId);
        total += resultat.count ?? 0;
      } catch (err: any) {
        erreurs++;
        this.logger.warn(
          `[BioTime] École ${config.organisationId} ignorée ce cycle : ${err.message}`,
        );
      }
    }

    return { ecoles: configs.length, total, erreurs };
  }

  private debutDeJournee(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /** BioTime attend « YYYY-MM-DD HH:mm:ss ». */
  private formatBiotime(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return (
      `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
      `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // WEBHOOK (si un serveur ou un relais sait pousser)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Réception poussée de pointages.
   *
   * L'API BioTime 8.5 ne sait pas appeler un tiers : cet endpoint ne sert qu'à un
   * relais ou un agent installé sur place. L'école est déduite du numéro de série
   * du terminal via l'appairage central, jamais du contenu du message.
   */
  async handleWebhook(payload: any): Promise<any> {
    const transactions = Array.isArray(payload) ? payload : [payload];
    let traites = 0;
    let sansEcole = 0;

    for (const txn of transactions) {
      if (!txn.emp_code || !txn.punch_time || !txn.terminal_sn) continue;

      const organisationId = await this.resoudreEcoleDuTerminal(txn.terminal_sn);
      if (!organisationId) {
        sansEcole++;
        this.logger.warn(
          `[BioTime] Terminal "${txn.terminal_sn}" non appairé : pointage conservé nulle part.`,
        );
        continue;
      }

      const identifiant = txn.id
        ? String(txn.id)
        : `WH-${new Date(txn.punch_time).getTime()}-${txn.emp_code}`;

      const existant = await this.punchRepository.findOne({
        where: { organisationId, biotimePunchId: identifiant },
      });
      if (existant) continue;

      const enfant = await this.childRepository.findOne({
        where: { organisationId, empCode: txn.emp_code },
      });

      await this.autoRegisterDevice(txn.terminal_sn);

      const punch = this.punchRepository.create({
        organisationId,
        biotimePunchId: identifiant,
        childId: enfant?.id,
        empCode: txn.emp_code,
        punchTime: new Date(txn.punch_time),
        punchState: txn.punch_state,
        verifyType: txn.verify_type,
        terminalSn: txn.terminal_sn,
      });
      await this.punchRepository.save(punch);
      traites++;

      this.eventEmitter.emit('punch.received', {
        child:
          enfant ?? {
            id: null,
            firstName: 'Élève',
            lastName: `Inconnu (${txn.emp_code})`,
            empCode: txn.emp_code,
          },
        punch,
      });
    }

    return { message: 'Webhook traité', processed: traites, sansEcole };
  }

  /** École propriétaire d'un terminal, d'après l'appairage central. */
  private async resoudreEcoleDuTerminal(serialNumber: string): Promise<string | null> {
    try {
      const lignes = await this.centralDataSource.query(
        `
          SELECT od.organisation_id AS "organisationId"
          FROM organisation_devices od
          INNER JOIN devices d ON d.id = od.device_id
          WHERE (d.serial_number = $1 OR d.imei = $1)
            AND od.released_at IS NULL
            AND d.deleted_at IS NULL
          LIMIT 1
        `,
        [serialNumber],
      );
      return lignes?.[0]?.organisationId ?? null;
    } catch (err: any) {
      this.logger.error(`Résolution du terminal ${serialNumber} impossible : ${err.message}`);
      return null;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // INVENTAIRE DES TERMINAUX
  // ───────────────────────────────────────────────────────────────────────────

  /** Terminaux du parc. Restreint à une école si `organisationId` est fourni. */
  async listDevices(organisationId?: string): Promise<any[]> {
    try {
      const filtreEcole = organisationId
        ? `INNER JOIN organisation_devices od
             ON od.device_id = d.id AND od.released_at IS NULL AND od.organisation_id = $1`
        : '';
      return await this.centralDataSource.query(
        `
          SELECT d.id, d.serial_number as "serialNumber", d.imei, d.type_device as "typeDevice",
                 d.status, d.last_seen_at as "lastSeenAt"
          FROM devices d
          ${filtreEcole}
          WHERE d.deleted_at IS NULL
          ORDER BY d.last_seen_at DESC NULLS LAST
        `,
        organisationId ? [organisationId] : [],
      );
    } catch (err: any) {
      this.logger.error(`Récupération des équipements impossible : ${err.message}`);
      return [];
    }
  }

  /** Inscrit le terminal à l'inventaire s'il est inconnu, et rafraîchit son heartbeat. */
  async autoRegisterDevice(serialNumber: string): Promise<void> {
    try {
      const existant = await this.centralDataSource.query(
        `SELECT id FROM devices WHERE serial_number = $1 AND deleted_at IS NULL LIMIT 1`,
        [serialNumber],
      );
      if (existant?.length) {
        await this.centralDataSource.query(
          `UPDATE devices SET last_seen_at = now(), status = 'ACTIVE' WHERE id = $1`,
          [existant[0].id],
        );
        return;
      }
      await this.centralDataSource.query(
        `INSERT INTO devices (type_device, serial_number, status, last_seen_at)
         VALUES ('BADGEUSE', $1, 'ACTIVE', now())`,
        [serialNumber],
      );
      this.logger.log(`[Inventaire] Badgeuse "${serialNumber}" mise en stock, sans école.`);
    } catch (err: any) {
      this.logger.error(`Auto-inscription de ${serialNumber} impossible : ${err.message}`);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SUPERVISION DES BADGEUSES VIA L'API BIOTIME (PHASE 1)
  // ───────────────────────────────────────────────────────────────────────────

  async getBiotimeTerminals(organisationId: string): Promise<any[]> {
    try {
      const data = await this.lire(organisationId, '/iclock/api/terminals/?page_size=500');
      const terminaux = data?.data;
      if (!Array.isArray(terminaux)) return [];

      return terminaux.map((t: any) => ({
        sn: t.sn,
        alias: t.alias,
        ipAddress: t.ip_address,
        isOnline: !!t.is_online,
        lastActivity: t.last_activity,
        fwVersion: t.fw_version,
        pushVersion: t.push_ver,
        platform: t.platform,
      }));
    } catch (error: any) {
      const message = error?.response?.status ? `HTTP ${error.response.status}` : error.message;
      this.logger.error(`[BioTime] Lecture terminaux école ${organisationId} : ${message}`);
      throw new HttpException(
        `Lecture des terminaux BioTime impossible : ${message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PROXY LECTURE DIRECTE DEPUIS BIOTIME (retourne les ID internes BioTime)
  // ───────────────────────────────────────────────────────────────────────────

  async getBiotimeEmployees(organisationId: string): Promise<any[]> {
    try {
      const data = await this.lire(organisationId, '/personnel/api/employees/?page_size=5000');
      return data?.data ?? [];
    } catch (error: any) {
      const message = error?.response?.status ? `HTTP ${error.response.status}` : error.message;
      throw new HttpException(
        `Lecture des employés BioTime impossible : ${message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // LECTURES POUR LA SUPERVISION (toujours limitées à une école)
  // ───────────────────────────────────────────────────────────────────────────

  async findAllChildren(organisationId: string, dateStr?: string): Promise<SuperAppChild[]> {
    const children = await this.childRepository.find({
      where: { organisationId },
      relations: { punches: true },
      order: { lastName: 'ASC', firstName: 'ASC' },
    });

    const jour = (dateStr ? new Date(dateStr) : new Date()).toDateString();
    for (const c of children) {
      if (c.punches) {
        c.punches = c.punches.filter((p) => new Date(p.punchTime).toDateString() === jour);
      }
    }
    return children;
  }

  async findAllPunches(organisationId: string, dateStr?: string): Promise<Record<string, any[]>> {
    const cible = dateStr ? new Date(dateStr) : new Date();
    const debut = new Date(cible);
    debut.setHours(0, 0, 0, 0);
    const fin = new Date(cible);
    fin.setHours(23, 59, 59, 999);

    const punches = await this.punchRepository.find({
      where: { organisationId, punchTime: Between(debut, fin) },
      relations: { child: true },
      order: { punchTime: 'DESC' },
    });

    const groupes: Record<string, any[]> = {};
    for (const p of punches) {
      const d = new Date(p.punchTime);
      const cle = d.toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      groupes[cle] ??= [];

      groupes[cle].push({
        id: p.id,
        punchTime: p.punchTime,
        time: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        stateCode: p.punchState,
        stateLabel: this.libelleSens(p.punchState),
        terminal: p.terminalSn ? `Terminal : ${p.terminalSn}` : 'Terminal inconnu',
        child: p.child
          ? {
              empCode: p.child.empCode,
              firstName: p.child.firstName,
              lastName: p.child.lastName,
              className: p.child.departmentName,
              photo: p.child.photo,
            }
          : {
              empCode: p.empCode || 'N/A',
              firstName: 'Élève',
              lastName: `Inconnu (${p.empCode || 'N/A'})`,
              className: 'Non assigné',
              photo: null,
            },
      });
    }
    return groupes;
  }

  async getPunchesByEmpCode(organisationId: string, empCode: string): Promise<any[]> {
    const depuis = new Date();
    depuis.setDate(depuis.getDate() - 60);

    const punches = await this.punchRepository.find({
      where: { organisationId, empCode, punchTime: Between(depuis, new Date()) },
      order: { punchTime: 'DESC' },
    });

    return punches.map((p) => {
      const d = new Date(p.punchTime);
      return {
        id: p.id,
        punchTime: p.punchTime,
        date: d.toISOString().split('T')[0],
        time: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        stateCode: p.punchState,
        stateLabel: this.libelleSens(p.punchState),
        terminal: p.terminalSn ? `Terminal : ${p.terminalSn}` : 'Terminal inconnu',
      };
    });
  }

  /**
   * Libellé du sens d'un pointage.
   *
   * S'appuie sur `sensFromPunchState`, source unique de cette règle. Les anciennes
   * versions devinaient le sens à partir de l'heure de la journée, avec des tranches
   * horaires différentes selon les écrans.
   */
  private libelleSens(punchState?: string): string {
    return sensFromPunchState(punchState) === SensPointage.DESCENTE ? 'DESCENTE' : 'MONTÉE';
  }

  async getEmployeeByEmpCode(organisationId: string, empCode: string): Promise<SuperAppChild> {
    const child = await this.childRepository.findOne({ where: { organisationId, empCode } });
    if (!child) {
      throw new HttpException('Employé introuvable dans cette école', HttpStatus.NOT_FOUND);
    }
    return child;
  }

  async getDirectory(organisationId: string): Promise<SuperAppChild[]> {
    return this.childRepository.find({
      where: { organisationId },
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
  }

  async getDirectoryBulk(organisationId: string, empCodes: string[]): Promise<SuperAppChild[]> {
    if (!empCodes?.length) return [];
    return this.childRepository.find({
      where: { organisationId, empCode: In(empCodes) },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // GESTION DES DÉPARTEMENTS (CLASSES) SUR BIOTIME (PHASE 2)
  // ───────────────────────────────────────────────────────────────────────────

  async getDepartments(organisationId: string): Promise<any[]> {
    try {
      const data = await this.lire(organisationId, '/personnel/api/departments/?page_size=500');
      return data?.data ?? [];
    } catch (error: any) {
      const message = error?.response?.status ? `HTTP ${error.response.status}` : error.message;
      throw new HttpException(
        `Lecture des départements impossible : ${message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async createDepartment(
    organisationId: string,
    donnees: { dept_name: string; parent_dept?: number },
  ): Promise<any> {
    try {
      const resultat = await this.appelBiotime(
        organisationId, 'post', '/personnel/api/departments/', donnees,
      );
      this.logger.log(
        `[BioTime] Département "${donnees.dept_name}" créé pour l'école ${organisationId}`,
      );
      return resultat;
    } catch (error: any) {
      const detail = error?.response?.data ?? error.message;
      throw new HttpException(
        { message: 'Création du département impossible sur BioTime', detail },
        error?.response?.status ?? HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async updateDepartment(
    organisationId: string,
    deptId: number,
    donnees: Record<string, any>,
  ): Promise<any> {
    try {
      const resultat = await this.appelBiotime(
        organisationId, 'patch', `/personnel/api/departments/${deptId}/`, donnees,
      );
      this.logger.log(
        `[BioTime] Département #${deptId} mis à jour pour l'école ${organisationId}`,
      );
      return resultat;
    } catch (error: any) {
      const detail = error?.response?.data ?? error.message;
      throw new HttpException(
        { message: 'Modification du département impossible sur BioTime', detail },
        error?.response?.status ?? HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async deleteDepartment(organisationId: string, deptId: number): Promise<void> {
    try {
      await this.appelBiotime(
        organisationId, 'delete', `/personnel/api/departments/${deptId}/`,
      );
      this.logger.log(
        `[BioTime] Département #${deptId} supprimé pour l'école ${organisationId}`,
      );
    } catch (error: any) {
      const detail = error?.response?.data ?? error.message;
      throw new HttpException(
        { message: 'Suppression du département impossible sur BioTime', detail },
        error?.response?.status ?? HttpStatus.BAD_GATEWAY,
      );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // GESTION DES ZONES (AREAS) SUR BIOTIME (PHASE 2)
  // ───────────────────────────────────────────────────────────────────────────

  async getAreas(organisationId: string): Promise<any[]> {
    try {
      const data = await this.lire(organisationId, '/personnel/api/areas/?page_size=500');
      return data?.data ?? [];
    } catch (error: any) {
      const message = error?.response?.status ? `HTTP ${error.response.status}` : error.message;
      throw new HttpException(
        `Lecture des zones impossible : ${message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async createArea(
    organisationId: string,
    donnees: { area_name: string; description?: string },
  ): Promise<any> {
    try {
      const resultat = await this.appelBiotime(
        organisationId, 'post', '/personnel/api/areas/', donnees,
      );
      this.logger.log(
        `[BioTime] Zone "${donnees.area_name}" créée pour l'école ${organisationId}`,
      );
      return resultat;
    } catch (error: any) {
      const detail = error?.response?.data ?? error.message;
      throw new HttpException(
        { message: 'Création de la zone impossible sur BioTime', detail },
        error?.response?.status ?? HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async updateArea(
    organisationId: string,
    areaId: number,
    donnees: Record<string, any>,
  ): Promise<any> {
    try {
      const resultat = await this.appelBiotime(
        organisationId, 'patch', `/personnel/api/areas/${areaId}/`, donnees,
      );
      this.logger.log(
        `[BioTime] Zone #${areaId} mise à jour pour l'école ${organisationId}`,
      );
      return resultat;
    } catch (error: any) {
      const detail = error?.response?.data ?? error.message;
      throw new HttpException(
        { message: 'Modification de la zone impossible sur BioTime', detail },
        error?.response?.status ?? HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async deleteArea(organisationId: string, areaId: number): Promise<void> {
    try {
      await this.appelBiotime(
        organisationId, 'delete', `/personnel/api/areas/${areaId}/`,
      );
      this.logger.log(
        `[BioTime] Zone #${areaId} supprimée pour l'école ${organisationId}`,
      );
    } catch (error: any) {
      const detail = error?.response?.data ?? error.message;
      throw new HttpException(
        { message: 'Suppression de la zone impossible sur BioTime', detail },
        error?.response?.status ?? HttpStatus.BAD_GATEWAY,
      );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SYNCHRONISATION BIDIRECTIONNELLE : SMARTBUS → BIOTIME
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Charge (ou renvoie depuis le cache) la table className→deptId pour une école.
   * Un seul GET /departments par tranche de 10 min, même pour 3000 pushes.
   */
  private async getDeptMap(organisationId: string): Promise<Map<string, number>> {
    const cached = this.deptCache.get(organisationId);
    if (cached && cached.expireLe > new Date()) return cached.data;

    const depts = await this.getDepartments(organisationId);
    const map = new Map<string, number>();
    for (const d of depts) {
      if (d.dept_name) map.set(d.dept_name.toLowerCase(), d.id);
    }

    this.deptCache.set(organisationId, {
      data: map,
      expireLe: new Date(Date.now() + BiotimeService.DEPT_CACHE_TTL_MS),
    });
    return map;
  }

  private invalidateDeptCache(organisationId: string): void {
    this.deptCache.delete(organisationId);
  }

  /**
   * Résout un nom de classe vers un ID de département BioTime.
   * Utilise le cache, crée le département s'il est absent, met à jour le cache.
   */
  async resolveDepartmentId(organisationId: string, className: string): Promise<number | null> {
    if (!className) return null;

    try {
      const map = await this.getDeptMap(organisationId);
      const existant = map.get(className.toLowerCase());
      if (existant) return existant;

      const nouveau = await this.createDepartment(organisationId, { dept_name: className });
      const newId = nouveau?.id ?? null;
      if (newId) map.set(className.toLowerCase(), newId);

      this.logger.log(
        `[BioTime→] Département "${className}" créé automatiquement pour l'école ${organisationId}`,
      );
      return newId;
    } catch (error: any) {
      this.logger.warn(
        `[BioTime→] Résolution du département "${className}" impossible : ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Pousse un enfant SMARTBUS vers BioTime.
   *
   * - Si `biotimeId` est fourni → PATCH (mise à jour)
   * - Sinon → POST (création)
   *
   * Retourne `{ biotimeId, action, error? }` pour que l'appelant puisse
   * mettre à jour le statut de sync.
   */
  async pushChild(
    organisationId: string,
    donnees: {
      empCode: string;
      firstName: string;
      lastName: string;
      className?: string;
      biotimeId?: number;
    },
  ): Promise<{ biotimeId: number | null; action: 'created' | 'updated' | 'skipped'; error?: string }> {
    try {
      await this.getAuthToken(organisationId);
    } catch {
      return {
        biotimeId: donnees.biotimeId ?? null,
        action: 'skipped',
        error: 'Serveur BioTime injoignable',
      };
    }

    try {
      const departmentId = donnees.className
        ? await this.resolveDepartmentId(organisationId, donnees.className)
        : null;

      if (donnees.biotimeId) {
        const patchData: Record<string, any> = {
          first_name: donnees.firstName,
          last_name: donnees.lastName,
        };
        if (departmentId !== null) patchData.department = departmentId;

        await this.updateEmployee(organisationId, donnees.biotimeId, patchData);
        return { biotimeId: donnees.biotimeId, action: 'updated' };
      }

      const emp_code = donnees.empCode || `SM-${Date.now()}`;
      const payload: Record<string, any> = {
        emp_code,
        first_name: donnees.firstName,
        last_name: donnees.lastName,
      };
      if (departmentId !== null) payload.department = departmentId;

      const resultat = await this.createEmployee(organisationId, payload as any);
      return { biotimeId: resultat?.id ?? null, action: 'created' };
    } catch (error: any) {
      const message = error?.response?.data?.detail
        ? JSON.stringify(error.response.data.detail)
        : error.message;
      this.logger.warn(
        `[BioTime→] Push échoué pour ${donnees.empCode} (école ${organisationId}) : ${message}`,
      );
      return { biotimeId: donnees.biotimeId ?? null, action: 'skipped', error: message };
    }
  }

  /**
   * Pousse un lot d'enfants vers BioTime, séquentiellement (serveurs école modestes)
   * mais avec un seul chargement de départements pour tout le batch.
   *
   * Conçu pour le bulk-import : 3000 élèves = 1 GET departments + 3000 POST employees.
   */
  async pushChildrenBatch(
    organisationId: string,
    enfants: Array<{
      childId: string;
      empCode: string;
      firstName: string;
      lastName: string;
      className?: string;
      biotimeId?: number;
    }>,
  ): Promise<Array<{ childId: string; biotimeId: number | null; action: string; error?: string }>> {
    const resultats: Array<{ childId: string; biotimeId: number | null; action: string; error?: string }> = [];

    try {
      await this.getAuthToken(organisationId);
    } catch {
      return enfants.map((e) => ({
        childId: e.childId,
        biotimeId: e.biotimeId ?? null,
        action: 'skipped',
        error: 'Serveur BioTime injoignable',
      }));
    }

    // Pré-charger le cache de départements une seule fois pour tout le batch
    try {
      await this.getDeptMap(organisationId);
    } catch {
      this.logger.warn(`[BioTime→] Impossible de charger les départements, push sans département.`);
    }

    for (const enfant of enfants) {
      const resultat = await this.pushChild(organisationId, enfant);
      resultats.push({ childId: enfant.childId, ...resultat });

      // Pause de 50ms entre chaque appel pour ne pas saturer le serveur BioTime
      if (enfants.length > 10) {
        await new Promise((r) => setTimeout(r, 50));
      }
    }

    const stats = {
      created: resultats.filter((r) => r.action === 'created').length,
      updated: resultats.filter((r) => r.action === 'updated').length,
      skipped: resultats.filter((r) => r.action === 'skipped').length,
    };
    this.logger.log(
      `[BioTime→] Batch push école ${organisationId} : ${enfants.length} enfant(s) → ` +
        `${stats.created} créé(s), ${stats.updated} mis à jour, ${stats.skipped} ignoré(s)`,
    );

    return resultats;
  }

  /**
   * Synchronise toutes les classes d'une école vers les départements BioTime.
   * Crée les départements manquants, ne supprime rien.
   */
  async syncDepartmentsFromClasses(
    organisationId: string,
    classNames: string[],
  ): Promise<{ created: string[]; existing: string[] }> {
    const created: string[] = [];
    const existing: string[] = [];

    this.invalidateDeptCache(organisationId);

    let map: Map<string, number>;
    try {
      map = await this.getDeptMap(organisationId);
    } catch {
      this.logger.warn(
        `[BioTime→] École ${organisationId} : impossible de lire les départements.`,
      );
      return { created, existing };
    }

    for (const name of classNames) {
      if (!name) continue;
      if (map.has(name.toLowerCase())) {
        existing.push(name);
        continue;
      }

      try {
        const nouveau = await this.createDepartment(organisationId, { dept_name: name });
        if (nouveau?.id) map.set(name.toLowerCase(), nouveau.id);
        created.push(name);
      } catch (error: any) {
        this.logger.warn(
          `[BioTime→] Création du département "${name}" échouée : ${error.message}`,
        );
      }
    }

    this.logger.log(
      `[BioTime→] Sync départements école ${organisationId} : ${created.length} créé(s), ${existing.length} existant(s)`,
    );
    return { created, existing };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // GESTION DES POSTES (POSITIONS) SUR BIOTIME (PHASE 3)
  // ───────────────────────────────────────────────────────────────────────────

  async getPositions(organisationId: string): Promise<any[]> {
    try {
      const data = await this.lire(organisationId, '/personnel/api/positions/?page_size=500');
      return data?.data ?? [];
    } catch (error: any) {
      const message = error?.response?.status ? `HTTP ${error.response.status}` : error.message;
      throw new HttpException(
        `Lecture des postes impossible : ${message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async createPosition(
    organisationId: string,
    donnees: { position_name: string },
  ): Promise<any> {
    try {
      const resultat = await this.appelBiotime(
        organisationId, 'post', '/personnel/api/positions/', donnees,
      );
      this.logger.log(
        `[BioTime] Poste "${donnees.position_name}" créé pour l'école ${organisationId}`,
      );
      return resultat;
    } catch (error: any) {
      const detail = error?.response?.data ?? error.message;
      throw new HttpException(
        { message: 'Création du poste impossible sur BioTime', detail },
        error?.response?.status ?? HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async updatePosition(
    organisationId: string,
    posId: number,
    donnees: Record<string, any>,
  ): Promise<any> {
    try {
      const resultat = await this.appelBiotime(
        organisationId, 'patch', `/personnel/api/positions/${posId}/`, donnees,
      );
      this.logger.log(
        `[BioTime] Poste #${posId} mis à jour pour l'école ${organisationId}`,
      );
      return resultat;
    } catch (error: any) {
      const detail = error?.response?.data ?? error.message;
      throw new HttpException(
        { message: 'Modification du poste impossible sur BioTime', detail },
        error?.response?.status ?? HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async deletePosition(organisationId: string, posId: number): Promise<void> {
    try {
      await this.appelBiotime(
        organisationId, 'delete', `/personnel/api/positions/${posId}/`,
      );
      this.logger.log(
        `[BioTime] Poste #${posId} supprimé pour l'école ${organisationId}`,
      );
    } catch (error: any) {
      const detail = error?.response?.data ?? error.message;
      throw new HttpException(
        { message: 'Suppression du poste impossible sur BioTime', detail },
        error?.response?.status ?? HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
