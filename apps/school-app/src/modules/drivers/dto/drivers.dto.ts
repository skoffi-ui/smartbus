import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsEmail,
} from 'class-validator';

export class CreateDriverDto {
  @ApiProperty({ example: 'Jean' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Diop' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'SN-123456789' })
  @IsString()
  @IsNotEmpty()
  licenseNumber: string;

  @ApiProperty({ example: '2028-05-12' })
  @IsDateString()
  @IsNotEmpty()
  licenseExpiry: string;

  @ApiProperty({ example: '+221770000000' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'jean.diop@example.com', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({
    example: 'uuid-du-vehicule',
    description: 'ID du bus assigné par défaut',
    required: false,
  })
  @IsString()
  @IsOptional()
  assignedCarId?: string;
}

export class UpdateDriverDto extends PartialType(CreateDriverDto) {}
