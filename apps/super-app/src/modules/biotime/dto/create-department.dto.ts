import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({
    description:
      "ID de l'organisation pour laquelle créer un département BioTime",
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  organisationId: string;
}
