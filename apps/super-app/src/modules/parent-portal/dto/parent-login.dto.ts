import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class ParentLoginDto {
  @ApiProperty({ description: "Email ou numéro de téléphone du parent" })
  @IsNotEmpty()
  @IsString()
  emailOrPhone: string;

  @ApiProperty({ description: "Code PIN d'accès (4 chiffres)" })
  @IsNotEmpty()
  @IsString()
  pinCode: string;

  @ApiProperty({ description: "Code unique de l'école (optionnel)", required: false })
  @IsOptional()
  @IsString()
  schoolCode?: string;
}
