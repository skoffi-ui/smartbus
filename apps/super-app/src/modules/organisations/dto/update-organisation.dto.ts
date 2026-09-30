import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsOptional } from 'class-validator';
import { SCHOOL_FEATURES } from '@app/common';
import { CreateOrganisationDto } from './create-organisation.dto';

export class UpdateOrganisationDto extends PartialType(CreateOrganisationDto) {
  /**
   * Permissions par école (voir `Organisation.allowedFeatures`). `null` =
   * aucune restriction. Un tableau = liste blanche des clés autorisées parmi
   * `SCHOOL_FEATURES`, assignée par le Super Admin.
   */
  @ApiPropertyOptional({
    type: [String],
    enum: SCHOOL_FEATURES,
    nullable: true,
    description:
      'Fonctionnalités school-web autorisées pour le directeur de cette école. null = tout autorisé.',
  })
  @IsOptional()
  @IsArray()
  @IsIn(SCHOOL_FEATURES, { each: true })
  allowedFeatures?: string[] | null;

  /**
   * Autorise le directeur de cette école à créer des comptes directeur
   * supplémentaires pour ses collaborateurs (voir `UsersService.createDirector`,
   * `UsersService.toggleStatus`). Accordé par le Super Admin, école par école.
   */
  @ApiPropertyOptional({
    description:
      'Autorise cette école à créer des comptes directeur supplémentaires.',
  })
  @IsOptional()
  @IsBoolean()
  allowAdditionalDirectors?: boolean;
}
