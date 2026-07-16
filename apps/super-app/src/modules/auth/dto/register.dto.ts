import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { UserRole } from '@app/database';

export class RegisterDto {
  @ApiProperty({ example: 'John', description: 'Prénom' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Doe', description: 'Nom de famille' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'john.doe@smartbus.com', description: 'Email' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+22670000000', description: 'Numéro de téléphone', required: false })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty({ example: 'Password123!', description: 'Mot de passe (min 8 caractères)' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({
    enum: UserRole,
    default: UserRole.PARENT,
    description: 'Rôle de l\'utilisateur',
    required: false,
  })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @ApiProperty({ description: 'ID de l\'organisation', required: false })
  @IsUUID()
  @IsOptional()
  organisationId?: string;
}
