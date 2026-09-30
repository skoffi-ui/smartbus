import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class ChangeParentPinDto {
  @ApiProperty({ description: 'Code PIN actuel (4 chiffres)', example: '1234' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}$/, {
    message: 'Le code PIN actuel doit être composé de 4 chiffres.',
  })
  ancienPin: string;

  @ApiProperty({
    description: 'Nouveau code PIN (4 chiffres)',
    example: '5678',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}$/, {
    message: 'Le nouveau code PIN doit être composé de 4 chiffres.',
  })
  nouveauPin: string;
}
