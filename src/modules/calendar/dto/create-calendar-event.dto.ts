import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CalendarEventStatus } from '../../../common/enums/calendar-event-status.enum';
import { CalendarEventType } from '../../../common/enums/calendar-event-type.enum';

export class CreateCalendarEventDto {
  @ApiProperty({ example: 'Pago de alquiler' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ example: 'Recordatorio para pagar antes del vencimiento' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: CalendarEventType, example: CalendarEventType.REMINDER })
  @IsEnum(CalendarEventType)
  type!: CalendarEventType;

  @ApiPropertyOptional({
    enum: CalendarEventStatus,
    example: CalendarEventStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(CalendarEventStatus)
  status?: CalendarEventStatus;

  @ApiProperty({ example: '2026-04-15T10:00:00.000Z' })
  @IsDateString()
  startAt!: string;

  @ApiPropertyOptional({ example: '2026-04-15T11:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  endAt?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  reminderMinutesBefore?: number;

  @ApiPropertyOptional({ example: '67fd0f8f6b2b7e2f2d6c1234' })
  @IsOptional()
  @IsString()
  assignedUserId?: string;

  @ApiPropertyOptional({ example: 'Juan Pérez' })
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional({ example: '5491112345678' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ example: 'Sucursal Canning' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: 'Confirmar asistencia antes del mediodía' })
  @IsOptional()
  @IsString()
  notes?: string;
}