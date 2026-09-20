import { IsString, IsOptional, IsEnum, IsUUID, IsArray, IsHexColor } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CourseStatus, CourseType } from '@app/database';

export class CreateCourseDto {
  @ApiProperty({ description: 'Nom de la course (ex: Aller Matin Lundi)' })
  @IsString()
  nom: string;

  @ApiPropertyOptional({
    enum: CourseType,
    description: "Moment de la tournée : matin, midi, soir ou spécial",
  })
  @IsOptional()
  @IsEnum(CourseType)
  type?: CourseType;

  @ApiPropertyOptional({ description: 'Heure de départ prévue (ex: 07:00)' })
  @IsOptional()
  @IsString()
  heureDepart?: string;

  @ApiPropertyOptional({ description: 'Heure d\'arrivée prévue (ex: 08:00)' })
  @IsOptional()
  @IsString()
  heureArrivee?: string;

  @ApiPropertyOptional({ description: 'UUID du trajet géographique associé' })
  @IsOptional()
  @IsUUID()
  trajetId?: string;

  @ApiPropertyOptional({ description: 'UUID du car affecté' })
  @IsOptional()
  @IsUUID()
  carId?: string;

  @ApiPropertyOptional({ description: 'UUID du chauffeur affecté' })
  @IsOptional()
  @IsUUID()
  driverId?: string;

  @ApiPropertyOptional({ enum: CourseStatus, description: 'Statut de la course' })
  @IsOptional()
  @IsEnum(CourseStatus)
  statut?: CourseStatus;

  @ApiPropertyOptional({ description: 'Description libre de la tournée' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: "Couleur d'affichage de la course sur la carte",
    example: '#2563EB',
  })
  @IsOptional()
  @IsHexColor()
  couleurCarte?: string;

  @ApiPropertyOptional({
    description: "Jours d'exécution de la tournée",
    example: ['L', 'M', 'Me', 'J', 'V'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  joursExecution?: string[];
}
