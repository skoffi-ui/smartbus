import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Ce qu'un directeur (SCHOOL_ADMIN) peut modifier lui-même sur SA PROPRE
 * école, depuis Paramètres → "Mon École" (school-web). Volontairement un
 * sous-ensemble restreint de `UpdateOrganisationDto` : ni `code`, `status`,
 * `allowedFeatures`, `allowAdditionalDirectors`, ni aucune colonne BioTime —
 * tout cela reste Super Admin uniquement (voir `OrganisationsController`,
 * routes `:id`). `ValidationPipe` global (`whitelist: true,
 * forbidNonWhitelisted: true`) garantit qu'aucun autre champ ne peut
 * passer, même envoyé volontairement par le client.
 */
export class UpdateMySchoolDto {
  @ApiPropertyOptional({ example: 'Lycée Saint-Exupéry' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: '+22670000000' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  website?: string;
}
