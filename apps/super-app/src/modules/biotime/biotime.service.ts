import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, IsNull, DataSource } from 'typeorm';
import { SuperAppChild, SuperAppPunch } from '@app/database';
import { firstValueFrom } from 'rxjs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class BiotimeService {
  private readonly logger = new Logger(BiotimeService.name);
  private cachedToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(SuperAppChild)
    private readonly childRepository: Repository<SuperAppChild>,
    @InjectRepository(SuperAppPunch)
    private readonly punchRepository: Repository<SuperAppPunch>,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly centralDataSource: DataSource,
  ) {}

  private get biotimeUrl(): string {
    const configPath = path.join(process.cwd(), 'data', 'config-biotime.json');
    try {
      if (fs.existsSync(configPath)) {
        const fileContent = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(fileContent);
        if (config && config.url) {
          return config.url;
        }
      }
    } catch (e) {
      this.logger.warn(`Impossible de lire config-biotime.json : ${e.message}`);
    }
    return this.configService.get<string>('BIOTIME_URL', 'http://160.120.143.20:8080');
  }

  async saveConfigUrl(url: string): Promise<any> {
    const configDir = path.join(process.cwd(), 'data');
    const configPath = path.join(configDir, 'config-biotime.json');
    try {
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      const config = { url };
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
      return { success: true, url };
    } catch (e) {
      this.logger.error(`Impossible de sauvegarder config-biotime.json : ${e.message}`);
      throw new HttpException('Échec de sauvegarde de la configuration.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async listDevices(): Promise<any[]> {
    try {
      const query = `
        SELECT id, serial_number as "serialNumber", imei, model, status, last_seen_at as "lastSeenAt"
        FROM devices
        WHERE deleted_at IS NULL
        ORDER BY last_seen_at DESC NULLS LAST
      `;
      return await this.centralDataSource.query(query);
    } catch (err) {
      this.logger.error(`Erreur lors de la récupération des équipements : ${err.message}`);
      return [];
    }
  }

  async autoRegisterDevice(serialNumber: string): Promise<void> {
    try {
      const existing = await this.centralDataSource.query(
        `SELECT id FROM devices WHERE serial_number = $1 AND deleted_at IS NULL LIMIT 1`,
        [serialNumber]
      );
      if (!existing || existing.length === 0) {
        this.logger.log(`[Auto-Register] Création de la badgeuse avec S/N: ${serialNumber}`);
        await this.centralDataSource.query(
          `INSERT INTO devices (type_device, serial_number, status, last_seen_at) 
           VALUES ('BADGEUSE', $1, 'ACTIVE', now())`,
          [serialNumber]
        );
      } else {
        await this.centralDataSource.query(
          `UPDATE devices SET last_seen_at = now(), status = 'ACTIVE' WHERE id = $1`,
          [existing[0].id]
        );
      }
    } catch (err) {
      this.logger.error(`Erreur lors de l'auto-enregistrement de la badgeuse ${serialNumber} : ${err.message}`);
    }
  }

  private get biotimeUser(): string {
    const user = this.configService.get<string>('BIOTIME_USER');
    if (!user) throw new Error("La variable d'environnement BIOTIME_USER est manquante.");
    return user;
  }

  private get biotimePassword(): string {
    const pass = this.configService.get<string>('BIOTIME_PASSWORD');
    if (!pass) throw new Error("La variable d'environnement BIOTIME_PASSWORD est manquante.");
    return pass;
  }

  /**
   * Obtient le token JWT pour communiquer avec l'API BioTime.
   */
  async getAuthToken(): Promise<string> {
    if (this.cachedToken && this.tokenExpiresAt && this.tokenExpiresAt > new Date()) {
      return this.cachedToken as string;
    }
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.biotimeUrl}/jwt-api-token-auth/`, {
          username: this.biotimeUser,
          password: this.biotimePassword,
        }, {
          headers: { 'Content-Type': 'application/json' }
        })
      );
      if (response.data && response.data.token) {
        const tokenStr = response.data.token;
        this.cachedToken = tokenStr;
        // BioTime tokens usually expire, cache it for 23 hours to be safe
        this.tokenExpiresAt = new Date(Date.now() + 23 * 60 * 60 * 1000);
        return tokenStr;
      }
      throw new Error('Token non reçu dans la réponse de BioTime');
    } catch (error) {
      this.logger.error('Erreur lors de la récupération du token BioTime', error.message);
      this.cachedToken = null;
      this.tokenExpiresAt = null;
      throw new HttpException('Erreur d\'authentification BioTime', HttpStatus.UNAUTHORIZED);
    }
  }

  /**
   * Synchronise les employés de BioTime vers la table super_app_children.
   */
  async syncChildren(): Promise<any> {
    const token = await this.getAuthToken();
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.biotimeUrl}/personnel/api/employees/?page_size=5000`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `JWT ${token}`
          }
        })
      );

      const employees = response.data.data;
      if (!employees || !Array.isArray(employees)) {
        return { message: 'Aucun employé trouvé', count: 0 };
      }

      let syncedCount = 0;
      for (const emp of employees) {
        let child = await this.childRepository.findOne({ where: { empCode: emp.emp_code } });
        if (!child) {
          child = this.childRepository.create({
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
          });
        } else {
          child.firstName = emp.first_name;
          child.lastName = emp.last_name;
          child.departmentId = emp.department ? emp.department.id?.toString() : undefined;
          child.departmentName = emp.department ? emp.department.dept_name : undefined;
          child.position = emp.position_name;
          child.hireDate = emp.hire_date ? new Date(emp.hire_date) : (null as any);
          child.fingerprint = emp.fingerprint;
          child.areas = emp.area;
          child.photo = emp.photo;
          child.mobile = emp.mobile;
          child.contactTel = emp.contact_tel;
          child.email = emp.email;
        }
        await this.childRepository.save(child);
        syncedCount++;
      }

      return { message: 'Synchronisation des employés réussie', count: syncedCount };
    } catch (error) {
      this.logger.error('Erreur lors de la synchronisation des employés BioTime', error.message);
      throw new HttpException('Erreur de synchronisation BioTime', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Synchronise les pointages (punches) depuis BioTime.
   */
  async syncPunches(dateStr?: string): Promise<any> {
    const token = await this.getAuthToken();
    try {
      const targetDate = dateStr ? new Date(dateStr) : new Date();
      const formattedDate = targetDate.toISOString().split('T')[0];

      const response = await firstValueFrom(
        this.httpService.get(`${this.biotimeUrl}/iclock/api/transactions/?start_time=${formattedDate} 00:00:00&end_time=${formattedDate} 23:59:59&page_size=5000`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `JWT ${token}`
          }
        })
      );

      const punches = response.data.data;
      if (!punches || !Array.isArray(punches)) {
        return { message: 'Aucun pointage trouvé pour cette date', count: 0 };
      }

      let syncedCount = 0;
      for (const p of punches) {
        const child = await this.childRepository.findOne({ where: { empCode: p.emp_code } });
        if (!child) continue;

        let punch = await this.punchRepository.findOne({ where: { biotimePunchId: p.id.toString() } });
        if (!punch) {
          if (p.terminal_sn) {
            await this.autoRegisterDevice(p.terminal_sn);
          }
          punch = this.punchRepository.create({
            biotimePunchId: p.id.toString(),
            childId: child.id,
            empCode: p.emp_code,
            punchTime: new Date(p.punch_time),
            punchState: p.punch_state,
            verifyType: p.verify_type,
            terminalSn: p.terminal_sn,
          });
          await this.punchRepository.save(punch);
          syncedCount++;
        }
      }

      return { message: 'Synchronisation des pointages réussie', count: syncedCount };
    } catch (error) {
      this.logger.error('Erreur lors de la synchronisation des pointages', error.message);
      throw new HttpException('Erreur de synchronisation des pointages', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Reçoit les pointages en temps réel depuis le Webhook de BioTime
   */
  async handleWebhook(payload: any): Promise<any> {
    this.logger.log(`Webhook reçu de BioTime: ${JSON.stringify(payload)}`);
    
    // BioTime peut envoyer un seul objet ou un tableau d'objets
    const transactions = Array.isArray(payload) ? payload : [payload];
    
    let processedCount = 0;
    
    for (const txn of transactions) {
      if (!txn.emp_code || !txn.punch_time || !txn.terminal_sn) {
        continue; // Ignorer les payloads mal formés
      }
 
      // Find the corresponding child (facultatif)
      const child = await this.childRepository.findOne({ where: { empCode: txn.emp_code } });
      const childId = child ? child.id : undefined;
      // Pour le webhook, on privilégie l'ID de transaction s'il est fourni
      const punchTime = new Date(txn.punch_time);
      let existingPunch = null;
      
      if (txn.id) {
        existingPunch = await this.punchRepository.findOne({ where: { biotimePunchId: txn.id.toString() } });
      }
      
      if (!existingPunch) {
        // BioTime n'envoie pas toujours un ID unique de transaction
        // On cherche un pointage proche (tolérance de ±2 secondes) pour éviter les doublons liés aux millisecondes
        const recentPunches = await this.punchRepository.find({ 
          where: { 
            childId: childId === undefined ? IsNull() : childId,
            terminalSn: txn.terminal_sn
          } 
        });
        existingPunch = recentPunches.find(p => Math.abs(new Date(p.punchTime).getTime() - punchTime.getTime()) <= 2000);
      } 
      if (txn.terminal_sn) {
        await this.autoRegisterDevice(txn.terminal_sn);
      }

      if (!existingPunch) {
        const punch = this.punchRepository.create({
          biotimePunchId: txn.id ? txn.id.toString() : `WH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          childId: childId,
          empCode: txn.emp_code,
          punchTime: punchTime,
          punchState: txn.punch_state,
          verifyType: txn.verify_type,
          terminalSn: txn.terminal_sn,
        });
        await this.punchRepository.save(punch);
        processedCount++;
 
        // Déclencher un événement pour le nouveau pointage
        this.eventEmitter.emit('punch.received', {
          child: child || { id: null, firstName: 'Élève', lastName: `Inconnu (${txn.emp_code})`, empCode: txn.emp_code },
          punch
        });
      }
    }
 
    return { message: 'Webhook traité avec succès', processed: processedCount };
  }

  /**
   * Retourne tous les enfants avec leurs pointages pour une date donnée
   */
  async findAllChildren(dateStr?: string): Promise<SuperAppChild[]> {
    const children = await this.childRepository.find({
      relations: { punches: true },
      order: { lastName: 'ASC', firstName: 'ASC' }
    });

    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const targetDateString = targetDate.toDateString();

    // Ne garder que les pointages de la date demandée
    children.forEach(c => {
      if (c.punches) {
        c.punches = c.punches.filter(p => {
          return new Date(p.punchTime).toDateString() === targetDateString;
        });
      }
    });

    return children;
  }

  /**
   * Retourne l'historique des pointages structuré par date, pour une date spécifique
   */
  async findAllPunches(dateStr?: string): Promise<Record<string, any[]>> {
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const punches = await this.punchRepository.find({
      where: { 
        punchTime: Between(startOfDay, endOfDay)
      },
      relations: { child: true },
      order: { punchTime: 'DESC' }
    });

    const grouped: Record<string, any[]> = {};
    
    // Dictionnaire de traduction des terminaux (à enrichir ou migrer en BDD plus tard)
    const TERMINAL_MAP: Record<string, string> = {
      'CKPM223460449': 'Bus Principal (Ligne 1)'
    };
    
    for (const p of punches) {
      // Create a local date string for grouping (YYYY-MM-DD)
      const dateObj = new Date(p.punchTime);
      const dateStr = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      
      if (!grouped[dateStr]) {
        grouped[dateStr] = [];
      }

      // Logique intelligente basée sur les tranches horaires
      const hour = dateObj.getHours();
      const isSaturday = dateObj.getDay() === 6;
      let stateLabel = '';

      if (isSaturday) {
        if (hour >= 4 && hour < 10) {
          stateLabel = 'MONTÉE';
        } else if (hour >= 10 && hour < 14) {
          stateLabel = 'DESCENTE';
        } else {
          stateLabel = p.punchState === '1' || p.punchState === '5' ? 'DESCENTE' : 'MONTÉE';
        }
      } else {
        if (hour >= 4 && hour < 12) {
          stateLabel = hour < 9 ? 'MONTÉE' : 'DESCENTE';
        } else if (hour >= 12 && hour < 23) {
          stateLabel = hour < 17 ? 'MONTÉE' : 'DESCENTE';
        } else {
          stateLabel = p.punchState === '1' || p.punchState === '5' ? 'DESCENTE' : 'MONTÉE';
        }
      }
      
      // Override avec la machine si l'état est explicite (0=Montée, 1=Descente)
      if (p.punchState === '0' || p.punchState === '4') stateLabel = 'MONTÉE';
      if (p.punchState === '1' || p.punchState === '5') stateLabel = 'DESCENTE';

      grouped[dateStr].push({
        id: p.id,
        punchTime: p.punchTime,
        time: dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        stateCode: p.punchState,
        stateLabel: stateLabel,
        terminal: TERMINAL_MAP[p.terminalSn] || `Terminal: ${p.terminalSn}`,
        child: p.child ? {
          empCode: p.child.empCode,
          firstName: p.child.firstName,
          lastName: p.child.lastName,
          className: p.child.departmentName,
          photo: p.child.photo
        } : {
          empCode: p.empCode || 'N/A',
          firstName: 'Élève',
          lastName: `Inconnu (${p.empCode || 'N/A'})`,
          className: 'Non assigné',
          photo: null
        }
      });
    }

    return grouped;
  }

  /**
   * Retourne l'historique des pointages pour un élève spécifique (via empCode)
   * Limité aux 60 derniers jours
   */
  async getPunchesByEmpCode(empCode: string): Promise<any[]> {
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const punches = await this.punchRepository.find({
      relations: { child: true },
      where: {
        child: { empCode: empCode },
        punchTime: Between(sixtyDaysAgo, new Date()),
        terminalSn: 'CKPM223460449'
      },
      order: { punchTime: 'DESC' }
    });

    // Translation dict
    const TERMINAL_MAP: Record<string, string> = {
      'CKPM223460449': 'Bus Principal (Ligne 1)'
    };

    return punches.map(p => {
      const dateObj = new Date(p.punchTime);
      const hour = dateObj.getHours();
      const isSaturday = dateObj.getDay() === 6;
      let stateLabel = '';

      if (isSaturday) {
        if (hour >= 4 && hour < 10) {
          stateLabel = 'MONTÉE';
        } else if (hour >= 10 && hour < 14) {
          stateLabel = 'DESCENTE';
        } else {
          stateLabel = p.punchState === '1' || p.punchState === '5' ? 'DESCENTE' : 'MONTÉE';
        }
      } else {
        if (hour >= 4 && hour < 12) {
          stateLabel = hour < 9 ? 'MONTÉE' : 'DESCENTE';
        } else if (hour >= 12 && hour < 23) {
          stateLabel = hour < 17 ? 'MONTÉE' : 'DESCENTE';
        } else {
          stateLabel = p.punchState === '1' || p.punchState === '5' ? 'DESCENTE' : 'MONTÉE';
        }
      }

      if (p.punchState === '0' || p.punchState === '4') stateLabel = 'MONTÉE';
      if (p.punchState === '1' || p.punchState === '5') stateLabel = 'DESCENTE';

      return {
        id: p.id,
        punchTime: p.punchTime,
        date: dateObj.toISOString().split('T')[0], // format YYYY-MM-DD
        time: dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        stateCode: p.punchState,
        stateLabel: stateLabel,
        terminal: TERMINAL_MAP[p.terminalSn] || `Terminal: ${p.terminalSn}`
      };
    });
  }

  /**
   * Retourne les informations de l'employé BioTime
   */
  async getEmployeeByEmpCode(empCode: string): Promise<SuperAppChild> {
    const child = await this.childRepository.findOne({ where: { empCode } });
    if (!child) {
      throw new HttpException('Employé introuvable', HttpStatus.NOT_FOUND);
    }
    return child;
  }

  /**
   * Retourne tout le répertoire des employés (enfants) synchronisés depuis BioTime
   */
  async getDirectory(): Promise<SuperAppChild[]> {
    return this.childRepository.find({
      order: { lastName: 'ASC', firstName: 'ASC' }
    });
  }

  /**
   * Retourne les détails complets pour une liste spécifique d'employés
   */
  async getDirectoryBulk(empCodes: string[]): Promise<SuperAppChild[]> {
    if (!empCodes || empCodes.length === 0) return [];
    
    // Fallback to query builder to handle IN clause elegantly
    return this.childRepository.createQueryBuilder('child')
      .where('child.empCode IN (:...empCodes)', { empCodes })
      .getMany();
  }
}
