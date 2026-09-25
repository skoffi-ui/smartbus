import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional, IsBoolean, IsDateString } from 'class-validator';

export class CreateCarDto {
  @ApiProperty({ example: 'AA-123-BB' })
  @IsString()
  @IsNotEmpty({ message: 'La plaque d\'immatriculation est obligatoire' })
  plateNumber: string;

  @ApiProperty({ example: 'Mercedes-Benz' })
  @IsString()
  @IsNotEmpty()
  brand: string;

  @ApiProperty({ example: 'Sprinter 319 CDI' })
  @IsString()
  @IsNotEmpty()
  model: string;

  @ApiProperty({ example: 2021, required: false })
  @IsNumber()
  @IsOptional()
  year?: number;

  @ApiProperty({ example: 30, description: 'Capacité en nombre de places', default: 30 })
  @IsNumber()
  @IsOptional()
  capacity?: number;

  @ApiProperty({ example: 'https://...', required: false })
  @IsString()
  @IsOptional()
  photoUrl?: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ example: '2027-12-31', required: false })
  @IsDateString()
  @IsOptional()
  insuranceExpiry?: string;

  @ApiProperty({ example: '2026-10-15', required: false })
  @IsDateString()
  @IsOptional()
  technicalInspectionExpiry?: string;

  @ApiProperty({ example: 'GPS-1234', required: false })
  @IsString()
  @IsOptional()
  gpsDeviceId?: string;

  @ApiProperty({ example: 'CKPM223460449', required: false, deprecated: true, description: 'Deprecated: use biotimeTerminalId instead' })
  @IsString()
  @IsOptional()
  biotimeTerminalSn?: string;

  @ApiProperty({ example: 'uuid-terminal-1', required: false, description: 'ID of the BioTime terminal assigned to this vehicle' })
  @IsString()
  @IsOptional()
  biotimeTerminalId?: string;
}

export class UpdateCarDto extends PartialType(CreateCarDto) {}
