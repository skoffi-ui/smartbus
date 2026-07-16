import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterSchoolDto {
  // --- Informations de l'École ---
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

  // --- Informations du compte Administrateur (Directeur) ---
  @ApiProperty({ description: "Prénom du directeur", example: 'Jean' })
  @IsString()
  @IsNotEmpty()
  adminFirstName: string;

  @ApiProperty({ description: "Nom du directeur", example: 'Dupont' })
  @IsString()
  @IsNotEmpty()
  adminLastName: string;

  @ApiProperty({ description: "Email de connexion du directeur", example: 'direction@sainte-marie.sn' })
  @IsEmail()
  @IsNotEmpty()
  adminEmail: string;

  @ApiProperty({ description: "Mot de passe", example: 'Password123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  adminPassword: string;
}
