import { Injectable, Logger } from '@nestjs/common';
import { TenantService } from '../tenant/tenant.service';
import { AlerteCritique } from '@app/database';

@Injectable()
export class AlertesCritiquesService {
  private readonly logger = new Logger(AlertesCritiquesService.name);

  constructor(private readonly tenantService: TenantService) {}

  /**
   * Retourne les N dernières anomalies critiques.
   *
   * `statut` restait figé sur `resolved = false` : les onglets « Résolues »/
   * « Toutes » de CentreAlertes.tsx n'avaient donc RIEN à afficher venant de
   * la base — ils ne montraient que ce qui avait été résolu pendant la
   * session en cours (état React local), perdu au premier rechargement.
   */
  async getUnresolved(
    tenantId: string,
    limit = 50,
    statut: 'unresolved' | 'resolved' | 'all' = 'unresolved',
  ): Promise<AlerteCritique[]> {
    try {
      const ds = await this.tenantService.getDataSource(tenantId);
      const clauseResolu =
        statut === 'unresolved'
          ? 'AND ac.resolved = false'
          : statut === 'resolved'
            ? 'AND ac.resolved = true'
            : '';
      // `driverId` de la course détectée, pour le bouton "Appeler le
      // chauffeur" de CentreAlertes.tsx — jusqu'ici il tentait de faire
      // correspondre `detectedCarPlate` à un champ `plateNumber` qui
      // n'existe pas sur `Driver` (aucune relation Car→Driver n'existe dans
      // ce schéma), donc ce panneau ne s'affichait jamais. Le vrai lien
      // existant est Course→Driver (`courses.driver_id`, posé et lu
      // réellement par Courses.tsx — `course_executions.driver_id` existe
      // dans le schéma mais n'est écrit nulle part, donc inexploitable).
      // Le nom/téléphone se résolvent côté client via `GET /drivers` (déjà
      // chargé par CentreAlertes.tsx) : pas besoin de les dupliquer ici.
      return ds.query(
        `
        SELECT
          ac.id, ac.type, ac.severity, ac.message,
          ac.child_id        AS "childId",
          ac.child_name      AS "childName",
          ac.child_emp_code  AS "childEmpCode",
          ac.detected_car_plate AS "detectedCarPlate",
          ac.terminal_sn     AS "terminalSn",
          ac.detected_course_id AS "detectedCourseId",
          ac.expected_course_id AS "expectedCourseId",
          ac.expected_stop_name AS "expectedStopName",
          ac.punch_time      AS "punchTime",
          ac.resolved,
          ac.resolved_at     AS "resolvedAt",
          ac.resolved_by     AS "resolvedBy",
          ac.resolution_note AS "resolutionNote",
          ac.created_at      AS "createdAt",
          co.driver_id       AS "driverId"
        FROM alertes_critiques ac
        LEFT JOIN courses co ON co.id = ac.detected_course_id
        WHERE ac.deleted_at IS NULL ${clauseResolu}
        ORDER BY ac.created_at DESC
        LIMIT $1
      `,
        [limit],
      );
    } catch (err: any) {
      this.logger.error(
        `Erreur récupération alertes_critiques : ${err.message}`,
      );
      return [];
    }
  }

  /**
   * Compte les anomalies non résolues (pour badge en temps réel).
   */
  async countUnresolved(tenantId: string): Promise<number> {
    try {
      const ds = await this.tenantService.getDataSource(tenantId);
      const result = await ds.query(`
        SELECT COUNT(*) AS count FROM alertes_critiques
        WHERE resolved = false AND deleted_at IS NULL
      `);
      return parseInt(result[0]?.count ?? '0', 10);
    } catch (err: any) {
      this.logger.error(`Erreur comptage alertes_critiques : ${err.message}`);
      return 0;
    }
  }

  /**
   * Marque une anomalie comme résolue.
   */
  async resolve(
    tenantId: string,
    alerteId: string,
    resolvedBy: string,
    note?: string,
  ): Promise<{ success: boolean }> {
    try {
      const ds = await this.tenantService.getDataSource(tenantId);
      await ds.query(
        `
        UPDATE alertes_critiques
        SET resolved = true,
            resolved_at = now(),
            resolved_by = $2,
            resolution_note = $3,
            updated_at = now()
        WHERE id = $1 AND deleted_at IS NULL
      `,
        [alerteId, resolvedBy, note ?? null],
      );
      return { success: true };
    } catch (err: any) {
      this.logger.error(
        `Erreur résolution alerte critique ${alerteId} : ${err.message}`,
      );
      return { success: false };
    }
  }
}
