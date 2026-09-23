import { IsString, IsOptional, IsNumber, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── Employés ──────────────────────────────────────────────────────────────

export class CreateBiotimeEmployeeDto {
  @ApiProperty({ example: '10042' })
  @IsString()
  @IsNotEmpty()
  emp_code: string;

  @ApiProperty({ example: 'Konan' })
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @ApiProperty({ example: 'Aya' })
  @IsString()
  @IsNotEmpty()
  last_name: string;

  @ApiPropertyOptional({ example: 1 })
  @IsNumber()
  @IsOptional()
  department?: number;

  @ApiPropertyOptional({ example: '0001234567' })
  @IsString()
  @IsOptional()
  card_no?: string;
}

export class UpdateBiotimeEmployeeDto {
  @ApiPropertyOptional({ example: 'Konan' })
  @IsString()
  @IsOptional()
  first_name?: string;

  @ApiPropertyOptional({ example: 'Aya' })
  @IsString()
  @IsOptional()
  last_name?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsNumber()
  @IsOptional()
  department?: number;

  @ApiPropertyOptional({ example: '0001234567' })
  @IsString()
  @IsOptional()
  card_no?: string;
}

// ── Départements (classes) ────────────────────────────────────────────────

export class CreateBiotimeDepartmentDto {
  @ApiProperty({ example: '6ème A' })
  @IsString()
  @IsNotEmpty()
  dept_name: string;

  @ApiPropertyOptional({ example: 1, description: 'ID du département parent' })
  @IsNumber()
  @IsOptional()
  parent_dept?: number;
}

export class UpdateBiotimeDepartmentDto {
  @ApiPropertyOptional({ example: '6ème B' })
  @IsString()
  @IsOptional()
  dept_name?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsNumber()
  @IsOptional()
  parent_dept?: number;
}

// ── Zones (areas) ─────────────────────────────────────────────────────────

export class CreateBiotimeAreaDto {
  @ApiProperty({ example: 'Cocody_Matin' })
  @IsString()
  @IsNotEmpty()
  area_name: string;

  @ApiPropertyOptional({ example: 'Trajet Cocody vers École — matin' })
  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateBiotimeAreaDto {
  @ApiPropertyOptional({ example: 'Cocody_Soir' })
  @IsString()
  @IsOptional()
  area_name?: string;

  @ApiPropertyOptional({ example: 'Trajet Cocody vers École — soir' })
  @IsString()
  @IsOptional()
  description?: string;
}

// ── Postes (positions) ────────────────────────────────────────────────────

export class CreateBiotimePositionDto {
  @ApiProperty({ example: 'Élève Standard' })
  @IsString()
  @IsNotEmpty()
  position_name: string;
}

export class UpdateBiotimePositionDto {
  @ApiPropertyOptional({ example: 'Élève à Besoins Spéciaux' })
  @IsString()
  @IsOptional()
  position_name?: string;
}
