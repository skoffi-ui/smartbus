import { Module } from '@nestjs/common';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

/**
 * Module Roles – gestion des rôles RBAC dans SMARTBUS.
 * Les rôles sont définis en tant qu'enum UserRole.
 * Ce module fournit des endpoints pour consulter et attribuer les rôles.
 */
@Module({
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
