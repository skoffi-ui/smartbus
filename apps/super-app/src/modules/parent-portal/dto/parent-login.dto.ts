import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class ParentLoginDto {
  @ApiProperty({
    description: 'Email ou numéro de téléphone du parent',
    example: 'parent@ecole.ci',
  })
  @IsNotEmpty()
  @IsString()
  emailOrPhone: string;

  @ApiProperty({
    description:
      "Code PIN d'accès (4 chiffres). Vérifié par bcrypt, jamais comparé en clair.",
    example: '1234',
    pattern: '^\\d{4}$',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}$/, {
    message: 'Le code PIN doit être composé de 4 chiffres.',
  })
  pinCode: string;

  @ApiProperty({
    description:
      "Code unique de l'établissement. Obligatoire : sans lui, la connexion parcourait toutes les bases école.",
    example: 'ECOLE01',
  })
  @IsString()
  @IsNotEmpty({ message: 'Le code établissement est obligatoire.' })
  schoolCode: string;
}
