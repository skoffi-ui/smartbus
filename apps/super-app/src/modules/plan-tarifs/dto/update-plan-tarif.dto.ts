import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';

export class UpdatePlanTarifDto {
  @ApiProperty({ required: false, example: 180000 })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  pricePerMonth?: number;

  @ApiProperty({ required: false, example: 15 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxCars?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxChildren?: number;

  @ApiProperty({ required: false, example: 'Standard' })
  @IsString()
  @IsOptional()
  label?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;
}
