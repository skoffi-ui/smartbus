import { Injectable, Logger } from '@nestjs/common';
import { TenantService } from '../tenant/tenant.service';
import { AlerteCritique } from '@app/database';

@Injectable()
export class AlertesCritiquesService {
  private readonly logger = new Logger(AlertesCritiquesService.name);

  constructor(private readonly tenantService: TenantService) {}

  /**
   * Retourne les N dernières anomalies critiques non résolues.
   */
  async getUnresolved(tenantId: string, limit = 50): Promise<AlerteCritique[]> {
    try {
      const ds = await this.tenantService.getDataSource(tenantId);
      return ds.query(`
        SELECT
          id, type, severity, message,
          child_id        AS "childId",
          child_name      AS "childName",
          child_emp_code  AS "childEmpCode",
          detected_car_plate AS "detectedCarPlate",
          terminal_sn     AS "terminalSn",
          detected_course_id AS "detectedCourseId",
          expected_course_id AS "expectedCourseId",
          expected_stop_name AS "expectedStopName",
          punch_time      AS "punchTime",
          resolved,
          created_at      AS "createdAt"
        FROM alertes_critiques
        WHERE resolved = false AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT $1
      `, [limit]);
    } catch (err: any) {
      this.logger.error(`Erreur récupération alertes_critiques : ${err.message}`);
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
  async resolve(tenantId: string, alerteId: string, resolvedBy: string, note?: string): Promise<{ success: boolean }> {
    try {
      const ds = await this.tenantService.getDataSource(tenantId);
      await ds.query(`
        UPDATE alertes_critiques
        SET resolved = true,
            resolved_at = now(),
            resolved_by = $2,
            resolution_note = $3,
            updated_at = now()
        WHERE id = $1 AND deleted_at IS NULL
      `, [alerteId, resolvedBy, note ?? null]);
      return { success: true };
    } catch (err: any) {
      this.logger.error(`Erreur résolution alerte critique ${alerteId} : ${err.message}`);
      return { success: false };
    }
  }
}
