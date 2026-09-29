import { IsUUID, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateAffectationDto {
  @ApiProperty({ description: 'UUID de l\'enfant à affecter' })
  @IsUUID()
  childId: string;

  @ApiProperty({ description: 'UUID du point de récupération (arrêt) associé' })
  @IsUUID()
  pointId: string;

  @ApiPropertyOptional({
    description:
      "UUID de la course pour laquelle cette affectation s'applique (un enfant peut avoir une " +
      "affectation par course — matin, retour midi, remontée 14h, descente 16h...). Omis pour les " +
      "affectations créées depuis TrajetEditor.tsx, indépendantes de toute course.",
  })
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @ApiPropertyOptional({ description: 'Ordre de montée de l\'enfant à l\'arrêt (pour priorisation)' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  ordreMontee?: number;
}
