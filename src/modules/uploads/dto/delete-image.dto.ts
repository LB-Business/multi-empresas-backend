import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class DeleteImageDto {
  @ApiProperty({
    example: 'concesionarias/lbcodeworks-autos/abc123xyz',
  })
  @IsString()
  @MinLength(3)
  publicId!: string;
}