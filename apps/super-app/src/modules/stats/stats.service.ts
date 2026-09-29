import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { ContextIdFactory, ModuleRef } from '@nestjs/core';
import {
  Organisation,
  OrganisationStatus,
  User,
  UserRole,
  Subscription,
  SubscriptionStatus,
  PlanTarif,
  BiotimeTerminal,
  TenantConnectionService,
} from '@app/database';

interface StatEcole {
  organisationId: string;
  nom: string;
  code: string;
  valeur: number;
}

const DOMAINES_TENANT = [
  'vehicules',
  'chauffeurs',
  'parents',
  'eleves',
  'courses',
  'trajets',
  'affectations',
  'alertes',
] as const;

type DomaineTenant = (typeof DOMAINES_TENANT)[number];

/**
 * Statistiques globales de la plateforme pour le tableau de bord Super Admin.
 *
 * Les compteurs "par école" (véhicules, chauffeurs, parents, élèves, courses,
 * trajets, affectations, alertes) vivent chacun dans la base TENANT de
 * l'école — il n'existe pas de vue agrégée côté base centrale. On ouvre donc
 * une connexion par école provisionnée (même mécanisme que `CronService`,
 * voir `TenantConnectionService`) et on y exécute une seule requête à
 * sous-SELECT multiples, pour ne pas payer 8 allers-retours par école.
 */
@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);

  constructor(
    @InjectRepository(Organisation) private readonly organisationRepo: Repository<Organisation>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Subscription) private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(PlanTarif) private readonly planTarifRepo: Repository<PlanTarif>,
    @InjectRepository(BiotimeTerminal) private readonly terminalRepo: Repository<BiotimeTerminal>,
    private readonly moduleRef: ModuleRef,
  ) {}

  /**
   * Connexion à la base d'une école, hors contexte HTTP — `TenantConnectionService`
   * est en portée requête (lit `x-tenant-id`), donc on lui fournit un faux contexte
   * avec l'identifiant explicite. Même technique que `CronService.connexionEcole`.
   */
  private async connexionEcole(organisationId: string) {
    const contextId = ContextIdFactory.create();
    this.moduleRef.registerRequestByContextId({}, contextId);
    const service = await this.moduleRef.resolve(TenantConnectionService, contextId, { strict: false });
    return service.getTenantConnection(organisationId);
  }

  async dashboard() {
    const organisations = await this.organisationRepo.find();
    const ecolesProvisionnees = organisations.filter((o) => o.dbProvisioned);

    const [utilisateurs, abonnements, planTarifs, biotime, parEcole] = await Promise.all([
      this.statsUtilisateurs(),
      this.statsAbonnements(),
      this.planTarifRepo.find({ order: { plan: 'ASC' } }),
      this.statsBiotime(organisations),
      this.statsParEcole(ecolesProvisionnees),
    ]);

    return {
      ecoles: {
        total: organisations.length,
        actives: organisations.filter((o) => o.status === OrganisationStatus.ACTIVE).length,
        suspendues: organisations.filter((o) => o.status === OrganisationStatus.SUSPENDED).length,
        trial: organisations.filter((o) => o.status === OrganisationStatus.TRIAL).length,
        pending: organisations.filter((o) => o.status === OrganisationStatus.PENDING).length,
      },
      utilisateurs,
      abonnements,
      planTarifs,
      biotime,
      ...parEcole,
    };
  }

  private async statsUtilisateurs() {
    const [administrateurs, directeurs] = await Promise.all([
      this.userRepo.count({ where: { role: UserRole.SUPER_ADMIN } }),
      this.userRepo.count({ where: { role: UserRole.SCHOOL_ADMIN } }),
    ]);
    return { administrateurs, directeurs };
  }

  private async statsAbonnements() {
    const abonnements = await this.subscriptionRepo.find();
    const parStatut: Record<string, number> = {};
    const parPlan: Record<string, number> = {};
    for (const a of abonnements) {
      parStatut[a.status] = (parStatut[a.status] ?? 0) + 1;
      parPlan[a.plan] = (parPlan[a.plan] ?? 0) + 1;
    }
    return {
      total: abonnements.length,
      actifs: parStatut[SubscriptionStatus.ACTIVE] ?? 0,
      parStatut,
      parPlan,
    };
  }

  /**
   * "Départements" BioTime = écoles ayant déjà un `biotimeDepartmentId` (1
   * département central par école, voir `biotime-central.service.ts`) ;
   * "Terminaux" = badgeuses connues du serveur central, assignées ou non.
   */
  private async statsBiotime(organisations: Organisation[]) {
    const [terminaux, terminauxAssignes] = await Promise.all([
      this.terminalRepo.count(),
      this.terminalRepo.count({ where: { organisationId: Not(IsNull()) } }),
    ]);
    return {
      departements: organisations.filter((o) => o.biotimeDepartmentId != null).length,
      terminaux,
      terminauxAssignes,
      terminauxLibres: terminaux - terminauxAssignes,
    };
  }

  /**
   * Boucle SÉQUENTIELLE volontaire (pas de `Promise.all`) : ouvrir toutes les
   * connexions tenant en parallèle pour un grand nombre d'écoles saturerait
   * le pool de connexions Postgres. Une école en échec (base non joignable)
   * ne doit pas faire échouer tout le tableau de bord.
   */
  private async statsParEcole(ecoles: Organisation[]) {
    const parEcole: Record<DomaineTenant, StatEcole[]> = {
      vehicules: [],
      chauffeurs: [],
      parents: [],
      eleves: [],
      courses: [],
      trajets: [],
      affectations: [],
      alertes: [],
    };
    let alertesCritiques = 0;

    for (const ecole of ecoles) {
      try {
        const ds = await this.connexionEcole(ecole.id);
        const [row] = await ds.query(`
          SELECT
            (SELECT COUNT(*) FROM cars WHERE deleted_at IS NULL) AS vehicules,
            (SELECT COUNT(*) FROM drivers WHERE deleted_at IS NULL) AS chauffeurs,
            (SELECT COUNT(*) FROM parents WHERE deleted_at IS NULL) AS parents,
            (SELECT COUNT(*) FROM children WHERE deleted_at IS NULL) AS eleves,
            (SELECT COUNT(*) FROM courses WHERE deleted_at IS NULL) AS courses,
            (SELECT COUNT(*) FROM trajets WHERE deleted_at IS NULL) AS trajets,
            (SELECT COUNT(*) FROM affectations) AS affectations,
            (SELECT COUNT(*) FROM alertes_critiques WHERE deleted_at IS NULL) AS alertes,
            (SELECT COUNT(*) FROM alertes_critiques WHERE deleted_at IS NULL AND severity = 'CRITICAL') AS "alertesCritiques"
        `);

        for (const domaine of DOMAINES_TENANT) {
          parEcole[domaine].push({
            organisationId: ecole.id,
            nom: ecole.name,
            code: ecole.code,
            valeur: Number(row?.[domaine] ?? 0),
          });
        }
        alertesCritiques += Number(row?.alertesCritiques ?? 0);
      } catch (err: any) {
        this.logger.warn(`Statistiques indisponibles pour l'école ${ecole.name} : ${err.message}`);
      }
    }

    const resultat: Record<string, { total: number; parEcole: StatEcole[]; critiques?: number }> = {};
    for (const domaine of DOMAINES_TENANT) {
      resultat[domaine] = {
        total: parEcole[domaine].reduce((somme, e) => somme + e.valeur, 0),
        parEcole: parEcole[domaine],
      };
    }
    resultat.alertes.critiques = alertesCritiques;
    return resultat;
  }
}
