import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ajoute le statut 'pending' (en attente du premier paiement) aux abonnements.
 * Utilisé par le flux de paiement CinetPay pour les abonnements créés avant règlement.
 */
export class AddPendingSubscriptionStatus1721140000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."subscriptions_status_enum" ADD VALUE IF NOT EXISTS 'pending'`,
    );
  }

  public async down(): Promise<void> {
    // PostgreSQL ne permet pas de retirer une valeur d'un ENUM : rien à annuler.
  }
}
