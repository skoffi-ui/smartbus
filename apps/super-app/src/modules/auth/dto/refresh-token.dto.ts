import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description:
      "Jeton de rafraîchissement. L'identifiant utilisateur est lu dans ce jeton après vérification (signature, expiration, type), et non dans le corps de la requête.",
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
