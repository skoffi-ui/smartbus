import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * Un directeur (déjà activé par le Super Admin, sans école pour l'instant)
 * crée lui-même son école — voir AuthService.creerMonEcole. Aucune identité
 * de directeur ici : c'est celle de l'appelant, déjà authentifié.
 */
export class CreateMySchoolDto {
  @ApiProperty({ description: "Nom complet de l'école", example: 'Lycée Saint-Exupéry' })
  @IsString()
  @IsNotEmpty()
  schoolName: string;

  @ApiPropertyOptional({ description: "Adresse physique", example: 'Dakar, Sénégal' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ description: "Numéro de téléphone", example: '+221770000000' })
  @IsString()
  @IsOptional()
  phone?: string;
}
