import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { ChildGender } from '@app/database/tenant-entities/child.entity';

export class CreateChildDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsOptional()
  dateOfBirth?: string;

  @IsEnum(ChildGender)
  @IsOptional()
  gender?: ChildGender;

  @IsString()
  @IsOptional()
  studentId?: string;

  @IsString()
  @IsOptional()
  className?: string;

  @IsString()
  @IsOptional()
  parentId?: string;

  @IsString()
  @IsOptional()
  empCode?: string;
}

export class UpdateChildDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  dateOfBirth?: string;

  @IsEnum(ChildGender)
  @IsOptional()
  gender?: ChildGender;

  @IsString()
  @IsOptional()
  studentId?: string;

  @IsString()
  @IsOptional()
  className?: string;

  @IsString()
  @IsOptional()
  parentId?: string;

  @IsString()
  @IsOptional()
  empCode?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
