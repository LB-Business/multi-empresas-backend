import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { ExpensePaymentStatus } from '../../../common/enums/expense-payment-status.enum';
import { ExpenseType } from '../../../common/enums/expense-type.enum';

export class FindExpensesDto {
  @ApiPropertyOptional({ example: '2026-04' })
  @IsOptional()
  @IsString()
  month?: string;

  @ApiPropertyOptional({ enum: ExpenseType, example: ExpenseType.FIXED })
  @IsOptional()
  @IsEnum(ExpenseType)
  type?: ExpenseType;

  @ApiPropertyOptional({
    enum: ExpensePaymentStatus,
    example: ExpensePaymentStatus.PAID,
  })
  @IsOptional()
  @IsEnum(ExpensePaymentStatus)
  paymentStatus?: ExpensePaymentStatus;

  @ApiPropertyOptional({
    example: true,
    description: 'Filtrar solo gastos que van al calendario',
  })
  @IsOptional()
  @IsBoolean()
  calendarEnabled?: boolean;
}