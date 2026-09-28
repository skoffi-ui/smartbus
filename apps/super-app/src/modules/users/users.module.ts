import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@app/database';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { OrganisationsModule } from '../organisations/organisations.module';

@Module({
  // OrganisationsModule : nécessaire pour valider l'école cible avant de lui
  // rattacher un nouveau directeur (voir UsersService.createDirector). Pas de
  // dépendance circulaire : OrganisationsModule n'importe pas UsersModule.
  imports: [TypeOrmModule.forFeature([User]), OrganisationsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
