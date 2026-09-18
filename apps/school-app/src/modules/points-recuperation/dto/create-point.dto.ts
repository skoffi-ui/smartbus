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
}
