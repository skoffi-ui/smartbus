import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { UserRole } from '@app/database';

export class CreateUserDto {
  @ApiProperty({ example: 'Jean' })
  @IsString()
  @IsNotEmpty({ message: 'Le prénom est requis' })
  firstName: string;

  @ApiProperty({ example: 'Dupont' })
  @IsString()
  @IsNotEmpty({ message: 'Le nom est requis' })
  lastName: string;

  @ApiProperty({ example: 'admin@smartbus.com' })
  @IsEmail({}, { message: 'Format email invalide' })
  @IsNotEmpty({ message: 'L\'email est requis' })
  email: string;

  @ApiProperty({ example: 'Password123!', required: false })
  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  @IsOptional()
  password?: string;

  @ApiProperty({ enum: UserRole, default: UserRole.SUPER_ADMIN, required: false })
  @IsEnum(UserRole, { message: 'Rôle invalide' })
  @IsOptional()
  role?: UserRole;
}
