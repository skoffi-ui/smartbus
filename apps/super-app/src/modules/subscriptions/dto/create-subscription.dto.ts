import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { SubscriptionPlan, SubscriptionStatus } from '@app/database';

export class CreateSubscriptionDto {
  @ApiProperty()
  @IsUUID()
  organisationId: string;

  @ApiProperty({ enum: SubscriptionPlan })
  @IsEnum(SubscriptionPlan)
  plan: SubscriptionPlan;

  @ApiProperty({ enum: SubscriptionStatus, required: false })
  @IsEnum(SubscriptionStatus)
  @IsOptional()
  status?: SubscriptionStatus;

  @ApiProperty({ example: '2025-01-01' })
  @IsDateString()
  startDate: Date;

  @ApiProperty({ example: '2025-12-31' })
  @IsDateString()
  endDate: Date;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  pricePerMonth: number;

  @ApiProperty({ default: 2 })
  @IsNumber()
  @IsOptional()
  maxCars?: number;
}
