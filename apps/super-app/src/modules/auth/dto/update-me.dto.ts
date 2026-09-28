import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Champs que l'utilisateur connecté peut modifier lui-même sur son profil.
 * Volontairement plus restreint que `UpdateUserDto` (module users) : pas de
 * rôle, pas de statut — un utilisateur ne doit pas pouvoir se les changer.
 */
export class UpdateMeDto {
  @ApiPropertyOptional({ example: 'Jean' })
  @IsString()
  @MinLength(1, { message: 'Le prénom ne peut pas être vide' })
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Dupont' })
  @IsString()
  @MinLength(1, { message: 'Le nom ne peut pas être vide' })
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ example: 'jean.dupont@ecole.com' })
  @IsEmail({}, { message: 'Format email invalide' })
  @IsOptional()
  email?: string;
}
