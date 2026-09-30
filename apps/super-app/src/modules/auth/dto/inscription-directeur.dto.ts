import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * Un directeur termine son propre compte à partir d'un lien d'invitation
 * (voir AuthService.rejoindreEcole) : lui seul choisit son prénom, nom,
 * email et mot de passe — le Super Admin n'a fait qu'autoriser l'école
 * concernée (voir `token`, qui porte uniquement l'organisationId).
 */
export class InscriptionDirecteurDto {
  @ApiProperty({
    description: "Jeton d'invitation reçu (porte l'école concernée)",
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ example: 'Awa' })
  @IsString()
  @IsNotEmpty({ message: 'Le prénom est requis' })
  firstName: string;

  @ApiProperty({ example: 'Koné' })
  @IsString()
  @IsNotEmpty({ message: 'Le nom est requis' })
  lastName: string;

  @ApiProperty({ example: 'directrice@ecole.sn' })
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
