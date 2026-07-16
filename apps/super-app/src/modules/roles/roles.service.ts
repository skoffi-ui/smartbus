import { Injectable } from '@nestjs/common';
import { UserRole } from '@app/database';

export interface RoleDescription {
  role: UserRole;
  label: string;
  description: string;
  permissions: string[];
}

@Injectable()
export class RolesService {
  private readonly roleDescriptions: RoleDescription[] = [
    {
      role: UserRole.SUPER_ADMIN,
      label: 'Super Administrateur',
      description: 'Accès complet à l\'ensemble de la plateforme SMARTBUS',
      permissions: ['*'],
    },
    {
      role: UserRole.SCHOOL_ADMIN,
      label: 'Administrateur École',
      description: 'Gestion complète d\'un établissement scolaire',
      permissions: [
        'children:read', 'children:write',
        'parents:read', 'parents:write',
        'drivers:read', 'drivers:write',
        'cars:read', 'cars:write',
        'routes:read', 'routes:write',
        'trips:read', 'trips:write',
        'biometric-events:read',
        'notifications:write',
      ],
    },
    {
      role: UserRole.DRIVER,
      label: 'Chauffeur',
      description: 'Accès aux courses assignées et scan biométrique',
      permissions: ['trips:read', 'biometric-events:write', 'routes:read'],
    },
    {
      role: UserRole.PARENT,
      label: 'Parent',
      description: 'Consultation du suivi de ses enfants',
      permissions: ['children:read', 'biometric-events:read', 'trips:read'],
    },
    {
      role: UserRole.CHILD,
      label: 'Enfant',
      description: 'Profil enfant (accès limité)',
      permissions: ['biometric-events:read'],
    },
  ];

  findAll(): RoleDescription[] {
    return this.roleDescriptions;
  }

  findOne(role: UserRole): RoleDescription | undefined {
    return this.roleDescriptions.find((r) => r.role === role);
  }

  getAllRoleNames(): UserRole[] {
    return Object.values(UserRole);
  }
}
