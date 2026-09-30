/**
 * Formes de données échangées avec le backend (`apps/super-app/src/modules/parent-portal/`).
 *
 * Dupliquées ici plutôt qu'importées depuis les DTO NestJS : partager du code
 * TypeScript entre ce projet Expo (son propre bundler Metro) et le monorepo
 * Nest CLI (webpack) alourdirait la configuration pour un gain minime — ces
 * formes sont petites et changent rarement. Si l'API évolue, ces types sont
 * le premier endroit à mettre à jour.
 */

export interface ParentLoginPayload {
  emailOrPhone: string;
  pinCode: string;
  schoolCode?: string;
}

export interface ParentSession {
  token: string;
  tenantId: string;
  schoolName: string;
  schoolCode: string;
  parent: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    notifPunchEnabled: boolean;
    notifProximityEnabled: boolean;
  };
}

export interface BusLine {
  id: string;
  name: string;
  type: string;
  heureDepart?: string;
  heureArrivee?: string;
  driver: { firstName?: string; lastName?: string; phone: string } | null;
  vehicule: {
    plateNumber: string;
    brand?: string;
    model?: string;
    photoUrl?: string;
  } | null;
}

export interface UsualStop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface Child {
  id: string;
  firstName: string;
  lastName: string;
  studentId?: string;
  className?: string;
  photoUrl?: string;
  usualStop: UsualStop | null;
  busLines: BusLine[];
}

export type NotificationType = 'PUNCH' | 'PROXIMITY';

export interface ParentNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType | string;
  isRead: boolean;
  metadata: Record<string, any> | null;
  childId: string;
  createdAt: string;
}
