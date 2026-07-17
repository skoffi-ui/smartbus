import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { SuperAppChild, SuperAppPunch } from '@app/database';
import { firstValueFrom } from 'rxjs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class BiotimeService {
  private readonly logger = new Logger(BiotimeService.name);

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(SuperAppChild)
    private readonly childRepository: Repository<SuperAppChild>,
    @InjectRepository(SuperAppPunch)
    private readonly punchRepository: Repository<SuperAppPunch>,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {}

  private get biotimeUrl(): string {
    return this.configService.get<string>('BIOTIME_URL', 'http://160.120.143.20:8080');
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
        return response.data.token;
      }
      throw new Error('Token non reçu dans la réponse de BioTime');
    } catch (error) {
      this.logger.error('Erreur lors de la récupération du token BioTime', error.message);
      throw new HttpException('Erreur d\'authentification BioTime', HttpStatus.UNAUTHORIZED);
    }
  }

  /**
   * Synchronise les employés de BioTime vers la table super_app_children.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
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
          if (emp.hire_date) {
            child.hireDate = new Date(emp.hire_date);
          }
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

      return { message: 'Synchronisation des enfants terminée', count: syncedCount };
    } catch (error) {
      this.logger.error('Erreur lors de la synchronisation des enfants', error.message);
      throw new HttpException('Erreur de synchronisation des enfants', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Synchronise les transactions (pointages) de BioTime vers la table super_app_punches.
   * Cette méthode s'exécute automatiquement toutes les 5 minutes.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async syncPunches(dateStr?: string): Promise<any> {
    const token = await this.getAuthToken();
    
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    const startStr = `${yyyy}-${mm}-${dd} 00:00:00`;
    const endStr = `${yyyy}-${mm}-${dd} 23:59:59`;

    try {
      let syncedCount = 0;
      const childrenSynced = new Set<string>();
      let nextUrl: string | null = `${this.biotimeUrl}/iclock/api/transactions/?start_time=${startStr}&end_time=${endStr}&page_size=5000`;

      while (nextUrl) {
        const response: any = await firstValueFrom(
          this.httpService.get(nextUrl, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `JWT ${token}`
            }
          })
        );

        const transactions = response.data.data;
        if (transactions && Array.isArray(transactions)) {
          for (const txn of transactions) {
            // Find the corresponding child
            const child = await this.childRepository.findOne({ where: { empCode: txn.emp_code } });
            if (!child) {
              this.logger.warn(`Pointage ignoré : Enfant avec empCode ${txn.emp_code} non trouvé.`);
              continue;
            }

            // Check if punch already exists
            const existingPunch = await this.punchRepository.findOne({ where: { biotimePunchId: txn.id.toString() } });
            if (!existingPunch) {
              const punch = this.punchRepository.create({
                biotimePunchId: txn.id.toString(),
                childId: child.id,
                punchTime: new Date(txn.punch_time),
                punchState: txn.punch_state,
                verifyType: txn.verify_type,
                terminalSn: txn.terminal_sn,
              });
              await this.punchRepository.save(punch);
              syncedCount++;
              childrenSynced.add(`${child.firstName} ${child.lastName}`);

              // Déclencher un événement pour le nouveau pointage
              this.eventEmitter.emit('punch.received', {
                child,
                punch
              });
            }
          }
        }
        
        nextUrl = response.data.next || null;
      }

      return { 
        message: `Synchronisation des pointages du ${startStr.split(' ')[0]} terminée`, 
        count: syncedCount,
        children: Array.from(childrenSynced)
      };
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

      // Find the corresponding child
      const child = await this.childRepository.findOne({ where: { empCode: txn.emp_code } });
      if (!child) {
        this.logger.warn(`Webhook: Pointage ignoré : Enfant avec empCode ${txn.emp_code} non trouvé.`);
        continue;
      }

      // Pour le webhook, BioTime n'envoie pas toujours un ID unique de transaction
      // On vérifie si on a déjà un pointage à la même heure exacte pour éviter les doublons
      const punchTime = new Date(txn.punch_time);
      const existingPunch = await this.punchRepository.findOne({ 
        where: { 
          childId: child.id,
          punchTime: punchTime,
          terminalSn: txn.terminal_sn
        } 
      });

      if (!existingPunch) {
        const punch = this.punchRepository.create({
          biotimePunchId: txn.id ? txn.id.toString() : `WH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          childId: child.id,
          punchTime: punchTime,
          punchState: txn.punch_state,
          verifyType: txn.verify_type,
          terminalSn: txn.terminal_sn,
        });
        await this.punchRepository.save(punch);
        processedCount++;

        // Déclencher un événement pour le nouveau pointage
        this.eventEmitter.emit('punch.received', {
          child,
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

    // Ne garder que les pointages de la date demandée et du bon terminal
    children.forEach(c => {
      if (c.punches) {
        c.punches = c.punches.filter(p => {
          return new Date(p.punchTime).toDateString() === targetDateString && p.terminalSn === 'CKPM223460449';
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
        punchTime: Between(startOfDay, endOfDay),
        terminalSn: 'CKPM223460449'
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
        } : null
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
