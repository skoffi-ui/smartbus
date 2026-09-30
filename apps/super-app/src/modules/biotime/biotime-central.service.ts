import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Organisation, BiotimeTerminal, TerminalStatus } from '@app/database';
import { firstValueFrom } from 'rxjs';

/**
 * Service de gestion centralisée du serveur BioTime
 *
 * Gère l'interaction avec UN SEUL serveur BioTime central pour toutes les écoles.
 * Utilise les départements BioTime pour isoler les données par organisation.
 */
@Injectable()
export class BiotimeCentralService {
  private readonly API_BASE: string;
  private readonly AUTH_TOKEN: string;

  constructor(
    @InjectRepository(Organisation)
    private readonly orgRepo: Repository<Organisation>,
    @InjectRepository(BiotimeTerminal)
    private readonly terminalRepo: Repository<BiotimeTerminal>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    // Configuration du serveur BioTime central (identique pour toutes les orgs).
    // Valeur par défaut '' plutôt que `getOrThrow` : le serveur BioTime n'est
    // pas encore fonctionnel aujourd'hui, et ça ne doit pas empêcher toute
    // l'application de démarrer. Les appels HTTP échoueront simplement (déjà
    // interceptés par des try/catch dans ce service) tant qu'il n'est pas configuré.
    this.API_BASE = this.configService.get<string>('BIOTIME_CENTRAL_URL', '');
    this.AUTH_TOKEN = this.configService.get<string>(
      'BIOTIME_CENTRAL_TOKEN',
      '',
    );
  }

  // ==================== GESTION DES DÉPARTEMENTS ====================

  /**
   * Créer un département BioTime pour une nouvelle organisation
   * 1 organisation = 1 département BioTime
   */
  async createDepartmentForOrganisation(orgId: string): Promise<Organisation> {
    const org = await this.orgRepo.findOne({ where: { id: orgId } });
    if (!org) {
      throw new NotFoundException('Organisation not found');
    }

    if (org.biotimeDepartmentId) {
      throw new BadRequestException(
        'Organisation already has a BioTime department',
      );
    }

    try {
      // Créer le département sur le serveur BioTime
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.API_BASE}/personnel/api/departments/`,
          {
            dept_name: org.name,
            dept_code: org.code,
            parent: null, // Département racine
          },
          {
            headers: {
              Authorization: `Token ${this.AUTH_TOKEN}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      // Sauvegarder l'ID du département
      org.biotimeDepartmentId = response.data.id;
      org.biotimeDepartmentName = response.data.dept_name;
      await this.orgRepo.save(org);

      return org;
    } catch (error) {
      throw new BadRequestException(
        `Failed to create BioTime department: ${error.message}`,
      );
    }
  }

  /**
   * Récupérer tous les départements du serveur BioTime
   */
  async getAllDepartmentsFromBiotime(): Promise<any[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.API_BASE}/personnel/api/departments/`, {
          headers: { Authorization: `Token ${this.AUTH_TOKEN}` },
        }),
      );
      return response.data.data || response.data;
    } catch (error) {
      throw new BadRequestException(
        `Failed to fetch departments: ${error.message}`,
      );
    }
  }

  // ==================== GESTION DES TERMINAUX ====================

  /**
   * Récupérer tous les terminaux disponibles sur le serveur BioTime central
   */
  async fetchAllTerminalsFromBiotime(): Promise<any[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.API_BASE}/iclock/api/terminals/`, {
          headers: { Authorization: `Token ${this.AUTH_TOKEN}` },
        }),
      );
      return response.data.data || response.data;
    } catch (error) {
      throw new BadRequestException(
        `Failed to fetch terminals from BioTime: ${error.message}`,
      );
    }
  }

  /**
   * Synchroniser les terminaux du serveur BioTime avec notre base de données
   * Crée ou met à jour les terminaux dans notre DB
   */
  async syncTerminalsFromBiotime(): Promise<{
    synced: number;
    created: number;
    updated: number;
  }> {
    const biotimeTerminals = await this.fetchAllTerminalsFromBiotime();
    let created = 0;
    let updated = 0;

    for (const btTerminal of biotimeTerminals) {
      let terminal = await this.terminalRepo.findOne({
        where: { serialNumber: btTerminal.sn },
      });

      if (!terminal) {
        // Créer un nouveau terminal
        terminal = this.terminalRepo.create({
          serialNumber: btTerminal.sn,
          terminalName:
            btTerminal.alias || btTerminal.terminal_name || btTerminal.sn,
          biotimeTerminalId: btTerminal.id,
          ipAddress: btTerminal.ip_address,
          model: btTerminal.terminal_name,
          status:
            btTerminal.state === 1
              ? TerminalStatus.ACTIVE
              : TerminalStatus.INACTIVE,
        });
        await this.terminalRepo.save(terminal);
        created++;
      } else {
        // Mettre à jour les infos
        terminal.biotimeTerminalId = btTerminal.id;
        terminal.ipAddress = btTerminal.ip_address;
        terminal.model = btTerminal.terminal_name;
        terminal.status =
          btTerminal.state === 1
            ? TerminalStatus.ACTIVE
            : TerminalStatus.INACTIVE;
        terminal.lastSyncAt = new Date();
        await this.terminalRepo.save(terminal);
        updated++;
      }
    }

    return { synced: biotimeTerminals.length, created, updated };
  }

  /**
   * Assigner un terminal à une organisation (école)
   */
  async assignTerminalToOrganisation(
    serialNumber: string,
    organisationId: string,
    terminalName?: string,
  ): Promise<BiotimeTerminal> {
    // Vérifier que le terminal existe dans notre DB
    let terminal = await this.terminalRepo.findOne({
      where: { serialNumber },
    });

    if (!terminal) {
      // Si le terminal n'existe pas, le chercher sur BioTime
      const biotimeTerminals = await this.fetchAllTerminalsFromBiotime();
      const biotimeTerminal = biotimeTerminals.find(
        (t) => t.sn === serialNumber,
      );

      if (!biotimeTerminal) {
        throw new NotFoundException(
          `Terminal ${serialNumber} not found on BioTime server`,
        );
      }

      // Créer le terminal dans notre DB
      terminal = this.terminalRepo.create({
        serialNumber,
        terminalName:
          terminalName ||
          biotimeTerminal.alias ||
          biotimeTerminal.terminal_name,
        biotimeTerminalId: biotimeTerminal.id,
        ipAddress: biotimeTerminal.ip_address,
        model: biotimeTerminal.terminal_name,
        status:
          biotimeTerminal.state === 1
            ? TerminalStatus.ACTIVE
            : TerminalStatus.INACTIVE,
      });
    }

    // Vérifier que l'organisation existe
    const org = await this.orgRepo.findOne({ where: { id: organisationId } });
    if (!org) {
      throw new NotFoundException('Organisation not found');
    }

    // Assigner le terminal
    terminal.organisationId = organisationId;
    if (terminalName) {
      terminal.terminalName = terminalName;
    }

    return await this.terminalRepo.save(terminal);
  }

  /**
   * Désassigner un terminal (le rendre disponible pour une autre école)
   */
  async unassignTerminal(terminalId: string): Promise<void> {
    const terminal = await this.terminalRepo.findOne({
      where: { id: terminalId },
    });
    if (!terminal) {
      throw new NotFoundException('Terminal not found');
    }

    terminal.organisationId = null;
    await this.terminalRepo.save(terminal);
  }

  /**
   * Lister les terminaux disponibles (non assignés à une école)
   */
  async getAvailableTerminals(): Promise<BiotimeTerminal[]> {
    return await this.terminalRepo.find({
      where: { organisationId: IsNull() },
      order: { serialNumber: 'ASC' },
    });
  }

  /**
   * Lister tous les terminaux connus localement (assignés ou non), avec leur
   * école le cas échéant. Toujours servi depuis notre base : contrairement à
   * `fetchAllTerminalsFromBiotime`, ne dépend pas du serveur BioTime central.
   */
  async getAllTerminals(): Promise<BiotimeTerminal[]> {
    return await this.terminalRepo.find({
      relations: { organisation: true },
      order: { serialNumber: 'ASC' },
    });
  }

  /**
   * Lister les terminaux assignés à une organisation
   */
  async getOrganisationTerminals(
    organisationId: string,
  ): Promise<BiotimeTerminal[]> {
    return await this.terminalRepo.find({
      where: { organisationId },
      relations: { organisation: true },
      order: { terminalName: 'ASC' },
    });
  }

  /**
   * Récupérer un terminal par son numéro de série
   */
  async getTerminalBySerialNumber(
    serialNumber: string,
  ): Promise<BiotimeTerminal> {
    const terminal = await this.terminalRepo.findOne({
      where: { serialNumber },
      relations: { organisation: true },
    });

    if (!terminal) {
      throw new NotFoundException(`Terminal ${serialNumber} not found`);
    }

    return terminal;
  }

  // ==================== GESTION DES EMPLOYÉS (Élèves) ====================

  /**
   * Créer ou mettre à jour un employé (élève) sur BioTime
   * dans le département de son organisation
   */
  async syncEmployeeToBiotime(
    empCode: string,
    firstName: string,
    lastName: string,
    departmentId: number,
    mobile?: string,
    email?: string,
  ): Promise<any> {
    const payload = {
      emp_code: empCode,
      first_name: firstName,
      last_name: lastName,
      department: departmentId,
      mobile: mobile || '',
      email: email || '',
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.API_BASE}/personnel/api/employees/`,
          payload,
          {
            headers: {
              Authorization: `Token ${this.AUTH_TOKEN}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return response.data;
    } catch (error) {
      // Si l'employé existe déjà, essayer de le mettre à jour
      if (error.response?.status === 400 && error.response?.data?.emp_code) {
        return await this.updateEmployeeOnBiotime(empCode, payload);
      }
      throw new BadRequestException(
        `Failed to sync employee to BioTime: ${error.message}`,
      );
    }
  }

  /**
   * Mettre à jour un employé existant sur BioTime
   */
  private async updateEmployeeOnBiotime(
    empCode: string,
    payload: any,
  ): Promise<any> {
    try {
      // Récupérer l'employé par emp_code
      const getResponse = await firstValueFrom(
        this.httpService.get(
          `${this.API_BASE}/personnel/api/employees/?emp_code=${empCode}`,
          {
            headers: { Authorization: `Token ${this.AUTH_TOKEN}` },
          },
        ),
      );

      const employees = getResponse.data.data || getResponse.data;
      if (!employees.length) {
        throw new NotFoundException('Employee not found');
      }

      const employeeId = employees[0].id;

      // Mettre à jour l'employé
      const updateResponse = await firstValueFrom(
        this.httpService.put(
          `${this.API_BASE}/personnel/api/employees/${employeeId}/`,
          payload,
          {
            headers: {
              Authorization: `Token ${this.AUTH_TOKEN}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return updateResponse.data;
    } catch (error) {
      throw new BadRequestException(
        `Failed to update employee on BioTime: ${error.message}`,
      );
    }
  }

  // ==================== RÉCUPÉRATION DES POINTAGES ====================

  /**
   * Récupérer les transactions (pointages) d'une organisation
   * Filtré automatiquement par le département de l'organisation
   */
  async getOrganisationTransactions(
    organisationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any[]> {
    const org = await this.orgRepo.findOne({ where: { id: organisationId } });
    if (!org || !org.biotimeDepartmentId) {
      throw new NotFoundException(
        'Organisation has no BioTime department assigned',
      );
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.API_BASE}/iclock/api/transactions/`, {
          params: {
            start_time: startDate.toISOString(),
            end_time: endDate.toISOString(),
            department: org.biotimeDepartmentId,
          },
          headers: { Authorization: `Token ${this.AUTH_TOKEN}` },
        }),
      );

      return response.data.data || response.data;
    } catch (error) {
      throw new BadRequestException(
        `Failed to fetch transactions: ${error.message}`,
      );
    }
  }

  /**
   * Récupérer les dernières transactions (par exemple, les 100 dernières)
   */
  async getRecentOrganisationTransactions(
    organisationId: string,
    limit: number = 100,
  ): Promise<any[]> {
    const org = await this.orgRepo.findOne({ where: { id: organisationId } });
    if (!org || !org.biotimeDepartmentId) {
      throw new NotFoundException(
        'Organisation has no BioTime department assigned',
      );
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.API_BASE}/iclock/api/transactions/`, {
          params: {
            department: org.biotimeDepartmentId,
            page_size: limit,
            ordering: '-punch_time', // Tri décroissant par date
          },
          headers: { Authorization: `Token ${this.AUTH_TOKEN}` },
        }),
      );

      return response.data.data || response.data;
    } catch (error) {
      throw new BadRequestException(
        `Failed to fetch recent transactions: ${error.message}`,
      );
    }
  }
}
