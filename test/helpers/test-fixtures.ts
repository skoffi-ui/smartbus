import { User, UserRole, UserStatus } from '@app/database';
import { Organisation } from '@app/database';

export const createMockUser = (overrides?: Partial<User>): Partial<User> => {
  return {
    id: '123e4567-e89b-12d3-a456-426614174000',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phoneNumber: '+225012345678',
    role: UserRole.PARENT,
    status: UserStatus.ACTIVE,
    avatarUrl: null,
    password: '$2b$10$hashedpassword',
    lastLoginAt: new Date(),
    organisationId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
};

export const createMockOrganisation = (
  overrides?: Partial<Organisation>,
): Partial<Organisation> => {
  return {
    id: '456e4567-e89b-12d3-a456-426614174001',
    name: 'École Primaire Test',
    slug: 'ecole-primaire-test',
    contactEmail: 'contact@ecole-test.ci',
    contactPhone: '+225012345678',
    address: '123 Rue de Test, Abidjan',
    city: 'Abidjan',
    country: 'Côte d\'Ivoire',
    dbHost: 'localhost',
    dbPort: 5432,
    dbName: 'smartbus_school_test',
    dbUsername: 'test_user',
    dbPassword: 'test_password',
    isActive: true,
    settings: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
};

export const createMockSuperAdmin = (): Partial<User> => {
  return createMockUser({
    role: UserRole.SUPER_ADMIN,
    email: 'admin@smartbus.ci',
    firstName: 'Super',
    lastName: 'Admin',
  });
};

export const createMockSchoolAdmin = (
  organisationId: string,
): Partial<User> => {
  return createMockUser({
    role: UserRole.SCHOOL_ADMIN,
    email: 'admin@school.ci',
    firstName: 'School',
    lastName: 'Admin',
    organisationId,
  });
};

export const createMockDriver = (organisationId: string): Partial<User> => {
  return createMockUser({
    role: UserRole.DRIVER,
    email: 'driver@school.ci',
    firstName: 'Driver',
    lastName: 'Test',
    organisationId,
  });
};

export const createMockParent = (organisationId: string): Partial<User> => {
  return createMockUser({
    role: UserRole.PARENT,
    email: 'parent@school.ci',
    firstName: 'Parent',
    lastName: 'Test',
    organisationId,
  });
};
