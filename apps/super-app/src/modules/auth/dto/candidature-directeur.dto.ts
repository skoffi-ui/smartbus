import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * Auto-inscription ouverte d'un directeur, depuis school-web — sans
 * invitation préalable, sans école : le compte est créé `PENDING`, sans
 * `organisationId`. Le Super Admin doit l'activer (voir UsersService.activate)
 * avant qu'il puisse se connecter (voir AuthService.validateUser) et créer
 * lui-même son école (voir AuthService.creerMonEcole).
 */
export class CandidatureDirecteurDto {
  @ApiProperty({ example: 'Awa' })
  @IsString()
  @IsNotEmpty({ message: 'Le prénom est requis' })
  firstName: string;

  @ApiProperty({ example: 'Koné' })
  @IsString()
  @IsNotEmpty({ message: 'Le nom est requis' })
  lastName: string;

  @ApiProperty({ example: 'direction@ecole.sn' })
  @IsEmail({}, { message: 'Format email invalide' })
  @IsNotEmpty({ message: "L'email est requis" })
  email: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8, {
    message: 'Le mot de passe doit contenir au moins 8 caractères',
  })
  @IsNotEmpty()
  password: string;
}
