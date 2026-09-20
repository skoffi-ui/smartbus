import { Child } from './tenant-entities/child.entity';
import { Car } from './tenant-entities/car.entity';
import { Course } from './tenant-entities/course.entity';
import { Trajet } from './tenant-entities/trajet.entity';
import { PointRecuperation } from './tenant-entities/point-recuperation.entity';
import { Affectation } from './tenant-entities/affectation.entity';
import { Montee } from './tenant-entities/montee.entity';
import { Pointage } from './tenant-entities/pointage.entity';
import { Alerte } from './tenant-entities/alerte.entity';
import { BiometricEvent } from './tenant-entities/biometric-event.entity';
import { Parent } from './tenant-entities/parent.entity';
import { Driver } from './tenant-entities/driver.entity';
import { Notification } from './tenant-entities/notification.entity';
import { AlerteCritique } from './tenant-entities/alerte-critique.entity';
import { Device } from './tenant-entities/device.entity';
import { DeviceAssignment } from './tenant-entities/device-assignment.entity';
import { BiometricConsent } from './tenant-entities/biometric-consent.entity';
import { CourseExecution } from './tenant-entities/course-execution.entity';

/**
 * Source unique des entités présentes dans chaque base école.
 * Utilisée par le provisionnement (création des tables) ET par la connexion dynamique
 * (TenantConnectionService) : les deux doivent toujours voir le même schéma.
 */
export const TENANT_ENTITIES = [
  Child,
  Car,
  Course,
  Trajet,
  PointRecuperation,
  Affectation,
  Montee,
  Pointage,
  Alerte,
  BiometricEvent,
  Parent,
  Driver,
  Notification,
  AlerteCritique,
  Device,
  DeviceAssignment,
  BiometricConsent,
  CourseExecution,
];
