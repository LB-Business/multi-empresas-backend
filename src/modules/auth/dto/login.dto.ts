import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'owner@gocars.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, example: 'MyStrongPassword123' })
  @IsString()
  @MinLength(8)
  password!: string;
}
