import { IsNotEmpty, IsString, IsOptional, IsUUID, IsArray, IsEnum, ValidateIf } from 'class-validator';
import { CourseStatus } from '@app/database';

export class CreateCourseDto {
  @IsString()
  @IsNotEmpty()
  nom: string;

  @IsString()
  @IsOptional()
  description?: string;

  @ValidateIf((o, v) => v !== null && v !== '')
  @IsUUID('4')
  @IsOptional()
  carId?: string;

  @ValidateIf((o, v) => v !== null && v !== '')
  @IsUUID('4')
  @IsOptional()
  driverId?: string;

  @ValidateIf((o, v) => v !== null && v !== '')
  @IsString()
  @IsOptional()
  chauffeur?: string;

  @IsString()
  @IsOptional()
  ecole?: string;

  @IsString()
  @IsOptional()
  heureDepart?: string;

  @IsString()
  @IsOptional()
  heureArrivee?: string;

  @IsArray()
  @IsOptional()
  joursExecution?: string[];

  @IsEnum(CourseStatus)
  @IsOptional()
  statut?: CourseStatus;

  @IsString()
  @IsOptional()
  couleurCarte?: string;

  @IsArray()
  @IsOptional()
  route?: any[];

  @IsArray()
  @IsOptional()
  markers?: any[];
}
