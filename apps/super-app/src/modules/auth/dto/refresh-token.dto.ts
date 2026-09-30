import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: "ID de l'utilisateur" })
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'Token de rafraîchissement' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
