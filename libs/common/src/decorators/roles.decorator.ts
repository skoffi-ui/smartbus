import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';

export const ROLES_KEY = 'roles';

/**
 * Décorateur @Roles – restreint l'accès à un ou plusieurs rôles.
 * @example @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
