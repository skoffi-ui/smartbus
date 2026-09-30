import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO de réponse paginée – structure standard pour toutes les listes paginées.
 */
export class PaginationResponseDto<T> {
  @ApiProperty({ description: 'Liste des éléments' })
  data: T[];

  @ApiProperty({ example: 100, description: "Nombre total d'éléments" })
  total: number;

  @ApiProperty({ example: 1, description: 'Page actuelle' })
  page: number;

  @ApiProperty({ example: 10, description: "Nombre d'éléments par page" })
  limit: number;

  @ApiProperty({ example: 10, description: 'Nombre total de pages' })
  totalPages: number;

  @ApiProperty({ example: true, description: 'Y a-t-il une page suivante ?' })
  hasNextPage: boolean;

  @ApiProperty({
    example: false,
    description: 'Y a-t-il une page précédente ?',
  })
  hasPreviousPage: boolean;

  constructor(data: T[], total: number, page: number, limit: number) {
    this.data = data;
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.totalPages = Math.ceil(total / limit);
    this.hasNextPage = page < this.totalPages;
    this.hasPreviousPage = page > 1;
  }
}
