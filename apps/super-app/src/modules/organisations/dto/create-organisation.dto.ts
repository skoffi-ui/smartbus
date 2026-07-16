import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { OrganisationStatus } from '@app/database';

export class CreateOrganisationDto {
  @ApiProperty({ example: 'Lycée Saint-Exupéry', description: 'Nom de l\'organisation' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'LSE-001', description: 'Code unique de l\'organisation (Généré automatiquement si non fourni)' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  @Matches(/^[A-Z0-9-_]+$/i, { message: 'Le code ne doit contenir que des lettres, chiffres, tirets et underscores' })
  code?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ required: false, example: '+22670000000' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  website?: string;

  @ApiProperty({ enum: OrganisationStatus, required: false })
  @IsEnum(OrganisationStatus)
  @IsOptional()
  status?: OrganisationStatus;
}
