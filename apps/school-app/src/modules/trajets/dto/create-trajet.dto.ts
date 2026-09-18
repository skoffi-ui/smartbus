import { IsString, IsOptional, IsObject } from 'class-validator';
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
}
