import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'john.doe@smartbus.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Password123!' }) 
  @IsString()
  @IsNotEmpty()
  password: string;
}
