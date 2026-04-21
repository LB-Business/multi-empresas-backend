import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class BootstrapSuperAdminDto {
  @ApiProperty({ example: 'Lucas Battelini' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'superadmin@lbcodeworks.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, example: 'SuperAdmin123!' })
  @IsString()
  @MinLength(8)
  password!: string;
}