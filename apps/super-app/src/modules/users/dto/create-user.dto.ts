import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * Création d'un collègue Super Admin depuis "Gestion de l'Équipe"
 * (apps/super-admin-web/src/pages/Users.tsx).
 *
 * Pas de champ `role` : cet endpoint ne crée volontairement que des comptes
 * SUPER_ADMIN (voir UsersService.create). Un directeur d'école n'est jamais
 * un simple utilisateur avec un rôle — il est indissociable d'une
 * organisation déjà provisionnée (base de données, abonnement...), ce que
 * seul `AuthService.registerSchool` sait faire correctement. Dupliquer cette
 * logique ici créerait un deuxième chemin de création divergent.
 */
export class CreateUserDto {
  @ApiProperty({ example: 'Jean' })
  @IsString()
  @IsNotEmpty({ message: 'Le prénom est requis' })
  firstName: string;

  @ApiProperty({ example: 'Dupont' })
  @IsString()
  @IsNotEmpty({ message: 'Le nom est requis' })
  lastName: string;

  @ApiProperty({ example: 'admin@smartbus.com' })
  @IsEmail({}, { message: 'Format email invalide' })
  @IsNotEmpty({ message: "L'email est requis" })
  email: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @MinLength(8, {
    message: 'Le mot de passe doit contenir au moins 8 caractères',
  })
  @IsNotEmpty({ message: 'Le mot de passe est requis' })
  password: string;
}
