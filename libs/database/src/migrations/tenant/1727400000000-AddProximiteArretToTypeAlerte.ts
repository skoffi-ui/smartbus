import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tenant Migration : ajoute la valeur `proximite_arret` à l'enum Postgres
 * `alertes_type_enum` (colonne `alertes.type`, entité `Alerte` — voir
 * `libs/database/src/tenant-entities/alerte.entity.ts`).
 *
 * Avant ça, l'approche d'un bus d'un arrêt (événement bénin) était écrite
 * dans `alertes` avec le type `gps_hors_zone` — réservé normalement à un
 * badgeage réellement REJETÉ pour incohérence GPS — polluant Alertes
 * Transport d'entrées usurpées.
 *
 * `ADD VALUE IF NOT EXISTS` (Postgres 12+) rend la migration idempotente,
 * même principe que les autres migrations tenant de cette session.
 */
export class AddProximiteArretToTypeAlerte1727400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "alertes_type_enum" ADD VALUE IF NOT EXISTS 'proximite_arret'`,
    );
  }

  public async down(): Promise<void> {
    // Postgres ne permet pas de retirer une valeur d'enum : aucune action possible.
    // Les lignes existantes avec ce type resteraient, ce qui est le comportement
    // attendu (on ne perd jamais de données d'alerte au rollback).
  }
}
