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
import { Currency } from 'src/common/enums/currency.enum';
import { ExpensePaymentStatus } from 'src/common/enums/expense-payment-status.enum';
import { ExpenseType } from 'src/common/enums/expense-type.enum';
import { ExpenseRecurrence } from '../schemas/expense.schema';

export class CreateExpenseDto {
  @ApiProperty({ example: 'Alquiler local' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ example: 'Alquiler' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'Pago del alquiler de abril' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ExpenseType, example: ExpenseType.FIXED })
  @IsEnum(ExpenseType)
  type!: ExpenseType;

  @ApiProperty({ example: 350000 })
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiProperty({ enum: Currency, example: Currency.ARS })
  @IsEnum(Currency)
  currency!: Currency;

  @ApiProperty({ example: '2026-04-14T12:00:00.000Z' })
  @IsDateString()
  expenseDate!: string;

  @ApiPropertyOptional({
    example: '2026-04-20T12:00:00.000Z',
    description: 'Fecha de vencimiento del gasto',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Indica si el gasto se repite automáticamente',
  })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional({
    enum: ExpenseRecurrence,
    example: ExpenseRecurrence.MONTHLY,
    description: 'Frecuencia de repetición del gasto',
  })
  @IsOptional()
  @IsEnum(ExpenseRecurrence)
  recurrence?: ExpenseRecurrence;

  @ApiPropertyOptional({
    example: '2026-12-31T12:00:00.000Z',
    description: 'Hasta cuándo se repite el gasto',
  })
  @IsOptional()
  @IsDateString()
  recurrenceEndDate?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Si debe aparecer en el calendario',
  })
  @IsOptional()
  @IsBoolean()
  calendarEnabled?: boolean;

  @ApiPropertyOptional({
    enum: ExpensePaymentStatus,
    example: ExpensePaymentStatus.PAID,
  })
  @IsOptional()
  @IsEnum(ExpensePaymentStatus)
  paymentStatus?: ExpensePaymentStatus;

  @ApiPropertyOptional({ example: 'Se pagó por transferencia' })
  @IsOptional()
  @IsString()
  notes?: string;
}