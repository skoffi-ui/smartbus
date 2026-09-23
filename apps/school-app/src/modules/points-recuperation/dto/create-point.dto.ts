import { IsString, IsNumber, IsOptional, IsUUID, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreatePointDto {
  @ApiProperty({ description: 'Nom du point de récupération (ex: Carrefour Anono)' })
  @IsString()
  nom: string;

  @ApiProperty({ description: 'Latitude GPS du point', example: 5.3608 })
  @IsNumber()
  @Type(() => Number)
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ description: 'Longitude GPS du point', example: -3.9999 })
  @IsNumber()
  @Type(() => Number)
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiProperty({ description: 'Ordre de passage sur le trajet (1 = premier arrêt)', example: 1 })
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  ordrePassage: number;

  @ApiPropertyOptional({ description: 'UUID du trajet auquel ce point appartient' })
  @IsOptional()
  @IsUUID()
  trajetId?: string;

  @ApiPropertyOptional({ description: 'Rayon de détection GPS en mètres (défaut: 30)' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  rayonDetection?: number;

  @ApiPropertyOptional({
    description: "Heure théorique de passage à cet arrêt (ex: 07:30) - Obsolète, utiliser heurePassage",
  })
  @IsOptional()
  @IsString()
  tempsArret?: string;

  @ApiPropertyOptional({
    description: "Heure de passage calculée automatiquement (format HH:mm)",
  })
  @IsOptional()
  @IsString()
  heurePassage?: string;

  @ApiPropertyOptional({
    description: "Durée d'arrêt en minutes (défaut: 2)",
    example: 2
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(30)
  dureeArretMin?: number;

  @ApiPropertyOptional({ description: "Commentaire libre sur l'arrêt" })
  @IsOptional()
  @IsString()
  commentaire?: string;

  @ApiPropertyOptional({
    description: 'Type de point: depart, arret, ou arrivee',
    enum: ['depart', 'arret', 'arrivee'],
    default: 'arret'
  })
  @IsOptional()
  @IsString()
  type?: string;
}
