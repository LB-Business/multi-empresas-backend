import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreatePublicBookingDto {
  @IsString()
  date!: string;

  @IsString()
  startTime!: string;

  @IsString()
  contactName!: string;

  @IsString()
  contactPhone!: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}