# Architecture Multi-Tenant SMARTBUS - Serveur BioTime Central

## 🎯 Nouvelle Vision

**UN seul serveur BioTime** pour **TOUTES les écoles**, avec isolation des données par école (multi-tenancy).

## 📊 Schéma Conceptuel

```
┌─────────────────────────────────────────────────────────────┐
│                  SERVEUR BIOTIME CENTRAL                     │
│  (biotime.votredomaine.com - Un seul serveur pour tous)    │
└─────────────┬───────────────────────────────────────────────┘
              │
              │ Affectation des terminaux par école
              │
    ┌─────────┼─────────┬─────────────┬─────────────┐
    │         │         │             │             │
┌───▼───┐ ┌──▼────┐ ┌──▼────┐   ┌───▼────┐   ┌───▼────┐
│Terminal│ │Terminal│ │Terminal│   │Terminal│   │Terminal│
│  SN001 │ │  SN002 │ │  SN003 │   │  SN010 │   │  SN011 │
└───┬───┘ └───┬────┘ └───┬────┘   └────┬───┘   └────┬───┘
    │         │          │              │            │
┌───▼─────────▼──────────▼───┐   ┌─────▼────────────▼──────┐
│   ÉCOLE NANGUI ABROGOUA    │   │  ÉCOLE SAINTE MARIE     │
│  (tenant: nangui-abrogoua) │   │  (tenant: sainte-marie) │
└────────────────────────────┘   └─────────────────────────┘
```

## 🏗️ Architecture Backend (NestJS)

### 1. Structure de base de données

#### **Entité Organisation** (déjà existante)

```typescript
@Entity('organisations')
export class Organisation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string; // "École Nangui Abrogoua"

  @Column({ unique: true })
  code: string; // "nangui-abrogoua" → utilisé comme tenantId

  @Column({ nullable: true })
  biotimeServerUrl: string; // Toujours le même : "https://biotime.central.com"

  @Column({ nullable: true })
  biotimeUsername: string; // Toujours le même : "admin"

  @Column({ nullable: true })
  biotimePassword: string; // Chiffré, toujours le même

  // NOUVEAU : Departement BioTime assigné à cette école
  @Column({ nullable: true })
  biotimeDepartmentId: number; // Chaque école = 1 département BioTime

  @Column({ nullable: true })
  biotimeDepartmentName: string; // "École Nangui Abrogoua"

  @OneToMany(() => BiotimeTerminal, (terminal) => terminal.organisation)
  biotimeTerminals: BiotimeTerminal[];
}
```

#### **NOUVELLE Entité : BiotimeTerminal**

```typescript
@Entity('biotime_terminals')
export class BiotimeTerminal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  serialNumber: string; // "SN001", "SN002", etc.

  @Column()
  terminalName: string; // "Badgeuse Bus 1 - Nangui"

  @Column({ type: 'int', nullable: true })
  biotimeTerminalId: number; // ID du terminal sur le serveur BioTime

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  model: string; // "ZKTeco F18", "SpeedFace-V5L", etc.

  @Column({
    type: 'enum',
    enum: ['ACTIVE', 'INACTIVE', 'ERROR'],
    default: 'INACTIVE',
  })
  status: string;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncAt: Date;

  // ASSOCIATION À UNE ÉCOLE
  @ManyToOne(() => Organisation, (org) => org.biotimeTerminals)
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Column({ name: 'organisation_id' })
  organisationId: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
```

#### **Entité Car** (mise à jour)

```typescript
@Entity('cars')
export class Car {
  // ... champs existants

  // LIEN VERS LE TERMINAL BIOTIME (au lieu du SN en string)
  @ManyToOne(() => BiotimeTerminal, { nullable: true })
  @JoinColumn({ name: 'biotime_terminal_id' })
  biotimeTerminal: BiotimeTerminal;

  @Column({ name: 'biotime_terminal_id', nullable: true })
  biotimeTerminalId: string;
}
```

#### **Entité Child** (mise à jour)

```typescript
@Entity('children')
export class Child {
  // ... champs existants

  @Column({ name: 'biotime_id', type: 'int', nullable: true })
  biotimeId: number; // ID de l'employé sur BioTime

  @Column({ name: 'biotime_emp_code', nullable: true })
  biotimeEmpCode: string; // Code employé unique sur BioTime

  // NOUVEAU : Department BioTime (hérité de l'organisation)
  @Column({ name: 'biotime_department_id', type: 'int', nullable: true })
  biotimeDepartmentId: number;

  @Column({
    name: 'biotime_sync_status',
    type: 'enum',
    enum: BiotimeSyncStatus,
    default: BiotimeSyncStatus.NOT_CONFIGURED,
  })
  biotimeSyncStatus: BiotimeSyncStatus;

  @Column({ name: 'biotime_sync_error', nullable: true })
  biotimeSyncError: string;
}
```

### 2. Service BioTime Central

```typescript
// apps/super-app/src/modules/biotime/biotime-central.service.ts

@Injectable()
export class BiotimeCentralService {
  private readonly API_BASE: string;
  private readonly AUTH_TOKEN: string;

  constructor(
    @InjectRepository(Organisation) private orgRepo: Repository<Organisation>,
    @InjectRepository(BiotimeTerminal)
    private terminalRepo: Repository<BiotimeTerminal>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    // Configuration centralisée
    this.API_BASE = this.configService.get('BIOTIME_CENTRAL_URL'); // https://biotime.central.com
    this.AUTH_TOKEN = this.configService.get('BIOTIME_CENTRAL_TOKEN');
  }

  // ===== GESTION DES DÉPARTEMENTS (1 département = 1 école) =====

  /**
   * Créer un département BioTime pour une nouvelle école
   */
  async createDepartmentForOrganisation(orgId: string): Promise<void> {
    const org = await this.orgRepo.findOne({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organisation not found');

    // Créer le département sur BioTime
    const response = await this.httpService
      .post(
        `${this.API_BASE}/personnel/api/departments/`,
        {
          dept_name: org.name,
          dept_code: org.code,
          parent: null, // Département racine
        },
        { headers: { Authorization: `Token ${this.AUTH_TOKEN}` } },
      )
      .toPromise();

    // Sauvegarder l'ID du département
    org.biotimeDepartmentId = response.data.id;
    org.biotimeDepartmentName = response.data.dept_name;
    await this.orgRepo.save(org);
  }

  // ===== GESTION DES TERMINAUX (Badgeuses) =====

  /**
   * Récupérer tous les terminaux disponibles sur le serveur BioTime
   */
  async fetchAllTerminalsFromBiotime(): Promise<any[]> {
    const response = await this.httpService
      .get(`${this.API_BASE}/iclock/api/terminals/`, {
        headers: { Authorization: `Token ${this.AUTH_TOKEN}` },
      })
      .toPromise();

    return response.data.data || response.data;
  }

  /**
   * Assigner un terminal BioTime à une école
   */
  async assignTerminalToOrganisation(
    serialNumber: string,
    organisationId: string,
    terminalName: string,
  ): Promise<BiotimeTerminal> {
    // Vérifier que le terminal existe sur BioTime
    const biotimeTerminals = await this.fetchAllTerminalsFromBiotime();
    const biotimeTerminal = biotimeTerminals.find((t) => t.sn === serialNumber);

    if (!biotimeTerminal) {
      throw new NotFoundException(
        `Terminal ${serialNumber} not found on BioTime server`,
      );
    }

    // Vérifier que l'école existe
    const org = await this.orgRepo.findOne({ where: { id: organisationId } });
    if (!org) throw new NotFoundException('Organisation not found');

    // Créer ou mettre à jour le terminal dans notre DB
    let terminal = await this.terminalRepo.findOne({ where: { serialNumber } });

    if (!terminal) {
      terminal = this.terminalRepo.create({
        serialNumber,
        terminalName,
        biotimeTerminalId: biotimeTerminal.id,
        ipAddress: biotimeTerminal.ip_address,
        model: biotimeTerminal.terminal_name,
        status: biotimeTerminal.state === 1 ? 'ACTIVE' : 'INACTIVE',
        organisationId,
      });
    } else {
      terminal.organisationId = organisationId;
      terminal.terminalName = terminalName;
      terminal.status = biotimeTerminal.state === 1 ? 'ACTIVE' : 'INACTIVE';
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
    if (!terminal) throw new NotFoundException('Terminal not found');

    terminal.organisationId = null;
    terminal.organisation = null;
    await this.terminalRepo.save(terminal);
  }

  /**
   * Lister les terminaux disponibles (non assignés)
   */
  async getAvailableTerminals(): Promise<BiotimeTerminal[]> {
    return await this.terminalRepo.find({
      where: { organisationId: IsNull() },
    });
  }

  /**
   * Lister les terminaux d'une école
   */
  async getOrganisationTerminals(
    organisationId: string,
  ): Promise<BiotimeTerminal[]> {
    return await this.terminalRepo.find({
      where: { organisationId },
      relations: ['organisation'],
    });
  }

  // ===== GESTION DES EMPLOYÉS (Élèves) =====

  /**
   * Synchroniser un élève vers BioTime dans le département de son école
   */
  async syncChildToBiotime(childId: string, tenantId: string): Promise<void> {
    // Récupérer l'élève avec son organisation
    const child = await this.getChildWithOrg(childId, tenantId);
    const org = child.organisation;

    if (!org.biotimeDepartmentId) {
      throw new BadRequestException(
        'Organisation has no BioTime department assigned',
      );
    }

    // Créer l'employé sur BioTime
    const payload = {
      emp_code: child.empCode || `${tenantId}-${child.id}`,
      first_name: child.firstName,
      last_name: child.lastName,
      department: org.biotimeDepartmentId, // ⭐ Assignation au département de l'école
      mobile: child.parent?.phone || '',
      email: child.parent?.email || '',
    };

    try {
      const response = await this.httpService
        .post(`${this.API_BASE}/personnel/api/employees/`, payload, {
          headers: { Authorization: `Token ${this.AUTH_TOKEN}` },
        })
        .toPromise();

      // Mettre à jour l'élève
      child.biotimeId = response.data.id;
      child.biotimeEmpCode = response.data.emp_code;
      child.biotimeDepartmentId = org.biotimeDepartmentId;
      child.biotimeSyncStatus = BiotimeSyncStatus.SYNCED;
      child.biotimeSyncError = null;

      await this.saveChild(child, tenantId);
    } catch (error) {
      child.biotimeSyncStatus = BiotimeSyncStatus.FAILED;
      child.biotimeSyncError = error.message;
      await this.saveChild(child, tenantId);
      throw error;
    }
  }

  // ===== RÉCUPÉRATION DES POINTAGES =====

  /**
   * Récupérer les pointages d'une école (filtré par département)
   */
  async getOrganisationTransactions(
    organisationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any[]> {
    const org = await this.orgRepo.findOne({ where: { id: organisationId } });
    if (!org || !org.biotimeDepartmentId) {
      throw new NotFoundException('Organisation has no BioTime department');
    }

    // Récupérer les transactions du département
    const response = await this.httpService
      .get(`${this.API_BASE}/iclock/api/transactions/`, {
        params: {
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
          department: org.biotimeDepartmentId, // ⭐ Filtrage par département
        },
        headers: { Authorization: `Token ${this.AUTH_TOKEN}` },
      })
      .toPromise();

    return response.data.data || response.data;
  }
}
```

### 3. Controller Super Admin

```typescript
// apps/super-app/src/modules/biotime/biotime-admin.controller.ts

@ApiTags('BioTime Admin')
@Controller('admin/biotime')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class BiotimeAdminController {
  constructor(private readonly biotimeService: BiotimeCentralService) {}

  // ===== GESTION DES TERMINAUX =====

  @Get('terminals/available')
  @ApiOperation({
    summary: 'Lister les terminaux BioTime disponibles (non assignés)',
  })
  async getAvailableTerminals() {
    return this.biotimeService.getAvailableTerminals();
  }

  @Get('terminals/all-from-server')
  @ApiOperation({
    summary: 'Récupérer tous les terminaux du serveur BioTime central',
  })
  async fetchAllTerminals() {
    return this.biotimeService.fetchAllTerminalsFromBiotime();
  }

  @Post('terminals/assign')
  @ApiOperation({ summary: 'Assigner un terminal à une école' })
  async assignTerminal(@Body() dto: AssignTerminalDto) {
    return this.biotimeService.assignTerminalToOrganisation(
      dto.serialNumber,
      dto.organisationId,
      dto.terminalName,
    );
  }

  @Delete('terminals/:id/unassign')
  @ApiOperation({ summary: 'Désassigner un terminal (le rendre disponible)' })
  async unassignTerminal(@Param('id') id: string) {
    await this.biotimeService.unassignTerminal(id);
    return { message: 'Terminal unassigned successfully' };
  }

  @Get('organisations/:orgId/terminals')
  @ApiOperation({ summary: "Lister les terminaux d'une école" })
  async getOrgTerminals(@Param('orgId') orgId: string) {
    return this.biotimeService.getOrganisationTerminals(orgId);
  }

  // ===== GESTION DES DÉPARTEMENTS =====

  @Post('organisations/:orgId/create-department')
  @ApiOperation({ summary: 'Créer un département BioTime pour une école' })
  async createDepartment(@Param('orgId') orgId: string) {
    await this.biotimeService.createDepartmentForOrganisation(orgId);
    return { message: 'Department created successfully' };
  }
}
```

## 🎨 Interface Super Admin Web

### Page de gestion des terminaux

```typescript
// apps/super-admin-web/src/pages/BiotimeTerminals.tsx

export default function BiotimeTerminals() {
  const [availableTerminals, setAvailableTerminals] = useState([]);
  const [organisations, setOrganisations] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState('');

  const handleAssignTerminal = async (serialNumber: string) => {
    await api.post('/admin/biotime/terminals/assign', {
      serialNumber,
      organisationId: selectedOrg,
      terminalName: `Badgeuse ${serialNumber}`
    });
    // Recharger
  };

  return (
    <div>
      <h1>Gestion des Terminaux BioTime</h1>

      <section>
        <h2>Terminaux Disponibles</h2>
        <select onChange={(e) => setSelectedOrg(e.target.value)}>
          <option value="">Sélectionner une école...</option>
          {organisations.map(org => (
            <option key={org.id} value={org.id}>{org.name}</option>
          ))}
        </select>

        <div className="terminals-grid">
          {availableTerminals.map(terminal => (
            <div key={terminal.serialNumber} className="terminal-card">
              <h3>{terminal.serialNumber}</h3>
              <p>IP: {terminal.ipAddress}</p>
              <p>Modèle: {terminal.model}</p>
              <button
                onClick={() => handleAssignTerminal(terminal.serialNumber)}
                disabled={!selectedOrg}
              >
                Assigner à {organisations.find(o => o.id === selectedOrg)?.name}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Terminaux Assignés par École</h2>
        {organisations.map(org => (
          <OrganisationTerminals key={org.id} organisation={org} />
        ))}
      </section>
    </div>
  );
}
```

## 🔄 Flux de Données

### 1. **Onboarding d'une nouvelle école**

```
1. Super Admin crée l'organisation dans la DB
2. System auto-crée un département BioTime pour l'école
3. Super Admin assigne des terminaux à l'école
4. L'école peut maintenant synchroniser ses élèves
```

### 2. **Synchronisation d'un élève**

```
École Nangui Abrogoua → POST /children
  ↓
Service Children créé l'élève dans la DB (tenant: nangui-abrogoua)
  ↓
Job BullMQ enfile la sync BioTime
  ↓
BiotimeProcessor synchronise vers le serveur central
  ↓
Élève créé dans le département "École Nangui Abrogoua" (dept_id: 5)
  ↓
biotimeId et biotimeDepartmentId sauvegardés dans Child
```

### 3. **Récupération des pointages**

```
Terminal SN001 (assigné à Nangui Abrogoua) → envoie un pointage
  ↓
Serveur BioTime Central enregistre le pointage avec dept_id: 5
  ↓
Webhook ou polling récupère les transactions dept_id: 5
  ↓
BullMQ route vers tenant "nangui-abrogoua"
  ↓
Création de l'enregistrement Montee dans la DB tenant
```

## 📁 Structure des Fichiers (Nouvelles migrations)

```
libs/database/src/
├── migrations/
│   └── shared/
│       └── 1727100000000-AddBiotimeTerminals.ts      # Nouvelle table
│       └── 1727100000001-UpdateOrganisationBiotime.ts # Ajout departmentId
│       └── 1727100000002-UpdateCarBiotimeTerminal.ts  # Relation terminal
│       └── 1727100000003-UpdateChildBiotimeDept.ts    # Ajout departmentId
├── entities/
│   └── biotime-terminal.entity.ts                     # Nouvelle entité
```

## ✅ Avantages de cette Architecture

1. **Centralisation** : Un seul serveur BioTime à maintenir
2. **Scalabilité** : Ajout d'écoles sans nouveau serveur
3. **Isolation** : Chaque école a son département → données isolées
4. **Flexibilité** : Réassignation facile des terminaux
5. **Coût** : Économie sur l'infrastructure BioTime
6. **Monitoring** : Vue centralisée de tous les terminaux

## 🚀 Prochaines Étapes d'Implémentation

1. ✅ Créer l'entité `BiotimeTerminal`
2. ✅ Migration pour ajouter `biotimeDepartmentId` à Organisation
3. ✅ Service `BiotimeCentralService`
4. ✅ Controller Admin pour gestion des terminaux
5. ✅ Interface Super Admin pour assigner les terminaux
6. ✅ Mettre à jour le processus de sync élèves
7. ✅ Mettre à jour le webhook/polling des pointages

---

**Cette architecture transforme SMARTBUS en une véritable plateforme SaaS multi-tenant professionnelle !** 🎉
