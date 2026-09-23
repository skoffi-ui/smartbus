import { IsString, IsOptional, IsObject, IsEnum, IsNumber, IsArray, Min } from 'class-validator';
import { TrajetSens } from '@app/database';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTrajetDto {
  @ApiProperty({ description: 'Nom du trajet (ex: Ligne A - Cocody → Plateau)' })
  @IsString()
  nom: string;

  @ApiPropertyOptional({
    description: 'GeoJSON LineString représentant le tracé de la polyline sur la carte',
    example: {
      type: 'LineString',
      coordinates: [[-3.99, 5.36], [-4.01, 5.34]],
    },
  })
  @IsOptional()
  @IsObject()
  geoJson?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Description libre du trajet' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    enum: TrajetSens,
    description: 'Sens du parcours : aller, retour ou mixte',
  })
  @IsOptional()
  @IsEnum(TrajetSens)
  sens?: TrajetSens;

  @ApiPropertyOptional({ description: 'Distance totale calculée par OSRM, en kilomètres' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceKm?: number;

  @ApiPropertyOptional({ description: "Durée estimée par OSRM, en minutes, hors arrêts" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  dureeEstimative?: number;

  @ApiPropertyOptional({ description: 'Heure de départ du trajet (format HH:mm)' })
  @IsOptional()
  @IsString()
  heureDepart?: string;

  @ApiPropertyOptional({
    description: 'Points de passage cliqués sur la carte',
    example: [{ lat: 5.36, lng: -3.99 }],
  })
  @IsOptional()
  @IsArray()
  waypoints?: any[];
}
