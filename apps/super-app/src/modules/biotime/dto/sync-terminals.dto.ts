import { ApiProperty } from '@nestjs/swagger';

export class SyncTerminalsResponseDto {
  @ApiProperty({
    description: 'Nombre total de terminaux synchronisés',
    example: 15,
  })
  synced: number;

  @ApiProperty({
    description: 'Nombre de nouveaux terminaux créés',
    example: 5,
  })
  created: number;

  @ApiProperty({
    description: 'Nombre de terminaux mis à jour',
    example: 10,
  })
  updated: number;
}
