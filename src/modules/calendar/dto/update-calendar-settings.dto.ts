import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class AvailabilityRangeDto {
  @IsString()
  start!: string;

  @IsString()
  end!: string;
}

class DateOverrideDto {
  @IsString()
  date!: string;

  @IsBoolean()
  isClosed!: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityRangeDto)
  ranges!: AvailabilityRangeDto[];
}

class WeeklyAvailabilityDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityRangeDto)
  monday?: AvailabilityRangeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityRangeDto)
  tuesday?: AvailabilityRangeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityRangeDto)
  wednesday?: AvailabilityRangeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityRangeDto)
  thursday?: AvailabilityRangeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityRangeDto)
  friday?: AvailabilityRangeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityRangeDto)
  saturday?: AvailabilityRangeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityRangeDto)
  sunday?: AvailabilityRangeDto[];
}

export class UpdateCalendarSettingsDto {
  @IsOptional()
  @IsBoolean()
  publicBookingEnabled?: boolean;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  slotDurationMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minAdvanceMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxAdvanceDays?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => WeeklyAvailabilityDto)
  weeklyAvailability?: WeeklyAvailabilityDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DateOverrideDto)
  dateOverrides?: DateOverrideDto[];
}