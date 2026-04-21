import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Currency } from 'src/common/enums/currency.enum';
import { ExpensePaymentStatus } from 'src/common/enums/expense-payment-status.enum';
import { ExpenseType } from 'src/common/enums/expense-type.enum';

export type ExpenseDocument = HydratedDocument<Expense>;

export enum ExpenseRecurrence {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

@Schema({ timestamps: true })
export class Expense {
  createdAt?: Date;
  updatedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Business', required: true, index: true })
  businessId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ type: String, default: null, trim: true, index: true })
  category?: string | null;

  @Prop({ type: String, default: null, trim: true })
  description?: string | null;

  @Prop({ type: String, enum: ExpenseType, required: true, index: true })
  type!: ExpenseType;

  @Prop({ type: Number, required: true, min: 0 })
  amount!: number;

  @Prop({ type: String, enum: Currency, required: true, default: Currency.ARS })
  currency!: Currency;

  @Prop({ type: Date, required: true, index: true })
  expenseDate!: Date;

  @Prop({ type: Date, default: null, index: true })
  dueDate?: Date | null;

  @Prop({ type: Boolean, default: false, index: true })
  isRecurring!: boolean;

  @Prop({
    type: String,
    enum: ExpenseRecurrence,
    default: null,
    index: true,
  })
  recurrence?: ExpenseRecurrence | null;

  @Prop({ type: Date, default: null, index: true })
  recurrenceEndDate?: Date | null;

  @Prop({ type: Boolean, default: false, index: true })
  calendarEnabled!: boolean;

  @Prop({
    type: String,
    enum: ExpensePaymentStatus,
    default: ExpensePaymentStatus.PAID,
    index: true,
  })
  paymentStatus!: ExpensePaymentStatus;

  @Prop({ type: String, default: null, trim: true })
  notes?: string | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  updatedBy?: Types.ObjectId | null;
}

export const ExpenseSchema = SchemaFactory.createForClass(Expense);

ExpenseSchema.index({ businessId: 1, expenseDate: -1 });
ExpenseSchema.index({ businessId: 1, dueDate: -1 });
ExpenseSchema.index({ businessId: 1, type: 1, expenseDate: -1 });
ExpenseSchema.index({ businessId: 1, paymentStatus: 1, expenseDate: -1 });
ExpenseSchema.index({ businessId: 1, category: 1, expenseDate: -1 });
ExpenseSchema.index({ businessId: 1, isRecurring: 1, recurrence: 1 });
ExpenseSchema.index({ businessId: 1, calendarEnabled: 1, dueDate: -1 });