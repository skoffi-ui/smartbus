import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

/**
 * Invite un directeur pour une école déjà provisionnée — depuis
 * super-admin-web ("Gestion de l'Équipe") OU depuis school-web ("Mon
 * Équipe", si autorisé). Le prénom, nom, email et mot de passe restent
 * choisis par le directeur lui-même en s'inscrivant via le lien renvoyé
 * (voir AuthService.rejoindreEcole). Aucun `User` n'existe avant cette
 * inscription — il n'apparaît dans la liste des directeurs qu'à ce moment-là.
 *
 * `organisationId` n'est utile qu'au Super Admin (qui choisit l'école) — un
 * directeur qui invite un collaborateur ne peut viser que sa propre école,
 * déjà connue du serveur via son jeton (voir UsersService.createDirector).
 */
export class CreateDirectorDto {
  @ApiPropertyOptional({
    description:
      "UUID de l'école (Super Admin uniquement — ignoré pour un directeur)",
  })
  @IsOptional()
  @IsUUID()
  organisationId?: string;
}
