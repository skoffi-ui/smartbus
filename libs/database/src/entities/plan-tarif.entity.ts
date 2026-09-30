import { Entity, Column } from 'typeorm';
import { BaseEntityModel } from './base.entity';
import { SubscriptionPlan } from './subscription.entity';

/**
 * Grille tarifaire — un tarif par forfait (`SubscriptionPlan`, enum fixe à
 * 5 valeurs). Le Super Admin peut ajuster prix et plafond de véhicules ici ;
 * aucune école n'a son propre tarif, un forfait vaut le même prix pour tous.
 *
 * Avant cette entité, aucun tarif central n'existait : le prix était soit
 * saisi à la main à chaque abonnement créé (super-admin-web/Subscriptions.tsx),
 * soit en dur et incomplet dans `PaymentsService.sandboxCheckout` (2 cas
 * seulement pour 5 forfaits), soit carrément inventé côté `Abonnement.tsx`
 * (school-web) faute d'une vraie source à afficher.
 */
@Entity('plan_tarifs')
export class PlanTarif extends BaseEntityModel {
  // `enumName` explicite : sans lui, TypeORM déduit un nom de type Postgres
  // à partir de cette table/colonne (`plan_tarifs_plan_enum`), différent de
  // celui réellement en base (`subscriptions_plan_enum`, partagé avec
  // `Subscription.plan`) — et tente de "corriger" l'écart à chaque
  // démarrage via `synchronize: true`, en renommant/recréant l'enum. Ça a
  // fait planter super-app au démarrage (DROP TYPE bloqué : les deux tables
  // dépendent du même type pendant l'opération). Ce nom doit rester
  // identique à celui de `Subscription.plan`.
  @Column({
    type: 'enum',
    enum: SubscriptionPlan,
    enumName: 'subscriptions_plan_enum',
    unique: true,
  })
  plan: SubscriptionPlan;

  @Column({ name: 'label', length: 100 })
  label: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  // `transformer` : une colonne `decimal` revient de Postgres/pg en chaîne
  // ("180000.00", pas le nombre 180000) — sans conversion, ça casse
  // silencieusement `.toLocaleString()` côté frontend et la validation
  // `@IsNumber()` de `UpdatePlanTarifDto` dès qu'on renvoie une valeur déjà
  // lue sans la retaper (ex. cliquer "Enregistrer" sans modifier le champ).
  @Column({
    name: 'price_per_month',
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: {
      to: (v: number) => v,
      from: (v: string | null) => (v === null ? null : parseFloat(v)),
    },
  })
  pricePerMonth: number;

  @Column({ name: 'max_cars' })
  maxCars: number;

  @Column({ name: 'max_children', nullable: true })
  maxChildren: number;
}
