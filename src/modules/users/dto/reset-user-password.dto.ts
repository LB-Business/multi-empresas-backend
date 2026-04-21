import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetUserPasswordDto {
  @ApiProperty({ minLength: 8, example: 'NuevaClave123!' })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}