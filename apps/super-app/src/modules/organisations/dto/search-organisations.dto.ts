import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '@app/common';

/**
 * `GET /organisations?search=...` renvoyait systématiquement 400
 * (`"property search should not exist"`) — le contrôleur liait `page`/`limit`
 * via `@Query() pagination: PaginationDto` (validé avec `whitelist: true,
 * forbidNonWhitelisted: true` globalement) ET `search` via un second
 * `@Query('search')` séparé, mais la validation du premier voit l'objet
 * query COMPLET et rejette `search` avant même que le second paramètre
 * n'ait la moindre chance de le récupérer. Un seul DTO combiné pour les
 * deux règle le problème à la racine.
 */
export class SearchOrganisationsDto extends PaginationDto {
  @ApiPropertyOptional({
    description: "Recherche libre sur le nom ou le code de l'organisation",
  })
  @IsOptional()
  @IsString()
  search?: string;
}
