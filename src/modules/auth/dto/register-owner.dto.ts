import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterOwnerDto {
  @ApiProperty({ example: 'Lucas Battelini' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'lucas@empresa.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '12345678' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: 'LB CodeWorks' })
  @IsString()
  businessName!: string;

  @ApiProperty({ example: 'lb-codeworks' })
  @IsString()
  businessSlug!: string;
}