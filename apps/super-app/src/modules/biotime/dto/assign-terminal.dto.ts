import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, IsOptional } from 'class-validator';

export class AssignTerminalDto {
  @ApiProperty({
    description: 'Numéro de série du terminal BioTime',
    example: 'SN001',
  })
  @IsNotEmpty()
  @IsString()
  serialNumber: string;

  @ApiProperty({
    description: "ID de l'organisation à laquelle assigner le terminal",
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  organisationId: string;

  @ApiProperty({
    description: 'Nom personnalisé du terminal (optionnel)',
    example: 'Badgeuse Bus 1 - École Nangui Abrogoua',
    required: false,
  })
  @IsOptional()
  @IsString()
  terminalName?: string;
}
