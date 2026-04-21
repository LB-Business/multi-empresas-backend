import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateBusinessStatusDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  isActive!: boolean;
}