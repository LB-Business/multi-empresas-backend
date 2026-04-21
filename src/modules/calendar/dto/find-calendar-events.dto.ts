import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { CalendarEventStatus } from 'src/common/enums/calendar-event-status.enum';
import { CalendarEventType } from 'src/common/enums/calendar-event-type.enum';

export class FindCalendarEventsDto {
  @ApiPropertyOptional({ enum: CalendarEventType })
  @IsOptional()
  @IsEnum(CalendarEventType)
  type?: CalendarEventType;

  @ApiPropertyOptional({ enum: CalendarEventStatus })
  @IsOptional()
  @IsEnum(CalendarEventStatus)
  status?: CalendarEventStatus;

  @ApiPropertyOptional({ example: '2026-04-01T00:00:00.000Z' })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-04-30T23:59:59.999Z' })
  @IsOptional()
  @IsString()
  dateTo?: string;

  @ApiPropertyOptional({ example: '67fd1f2f7f1d2a0012345678' })
  @IsOptional()
  @IsString()
  assignedUserId?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Filtra gastos que se muestran en calendario',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  calendarEnabled?: boolean;
}