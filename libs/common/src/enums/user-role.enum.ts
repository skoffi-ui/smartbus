/**
 * Enum UserRole – rôles du système SMARTBUS.
 * Copie locale dans la lib common pour éviter les imports circulaires.
 */
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  SCHOOL_ADMIN = 'school_admin',
  DRIVER = 'driver',
  PARENT = 'parent',
  CHILD = 'child',
}
