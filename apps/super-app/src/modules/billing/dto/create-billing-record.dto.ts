import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { PaymentMethod, PaymentStatus } from '@app/database';

export class CreateBillingRecordDto {
  @ApiProperty()
  @IsUUID()
  organisationId: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ default: 'XOF' })
  @IsString()
  @IsOptional()
  currency?: string = 'XOF';

  @ApiProperty({ enum: PaymentStatus, required: false })
  @IsEnum(PaymentStatus)
  @IsOptional()
  status?: PaymentStatus;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  periodStart?: Date;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  periodEnd?: Date;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;
}
