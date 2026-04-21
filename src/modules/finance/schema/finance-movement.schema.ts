import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Currency } from '../../../common/enums/currency.enum';

export type FinanceMovementDocument = HydratedDocument<FinanceMovement>;

export enum FinanceMovementDirection {
  IN = 'in',
  OUT = 'out',
}

export enum FinanceMovementType {
  EXPENSE_MANUAL = 'expense_manual',
  PRODUCT_EXTRA_EXPENSE = 'product_extra_expense',
  VEHICLE_PURCHASE = 'vehicle_purchase',
  DEPOSIT_RECEIVED = 'deposit_received',
  DEPOSIT_REFUNDED = 'deposit_refunded',
  PRODUCT_SALE = 'product_sale',
  CONSIGNMENT_SETTLEMENT = 'consignment_settlement',
}

@Schema({ timestamps: true })
export class FinanceMovement {
  createdAt?: Date;
  updatedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Business', required: true, index: true })
  businessId!: Types.ObjectId;

  @Prop({
    type: String,
    enum: FinanceMovementDirection,
    required: true,
    index: true,
  })
  direction!: FinanceMovementDirection;

  @Prop({
    type: String,
    enum: FinanceMovementType,
    required: true,
    index: true,
  })
  type!: FinanceMovementType;

  @Prop({ type: String, required: true, trim: true })
  title!: string;

  @Prop({ type: String, default: null, trim: true })
  description?: string | null;

  @Prop({ type: Number, required: true, min: 0 })
  amount!: number;

  @Prop({
    type: String,
    enum: Currency,
    required: true,
    default: Currency.ARS,
  })
  currency!: Currency;

  @Prop({ type: Date, required: true, index: true })
  date!: Date;

  @Prop({ type: String, enum: ['expense', 'product'], required: true })
  source!: 'expense' | 'product';

  @Prop({ type: String, required: true, trim: true, index: true })
  sourceId!: string;

  @Prop({ type: String, default: null, trim: true, index: true })
  productId?: string | null;

  @Prop({ type: String, default: null, trim: true })
  productName?: string | null;

  @Prop({ type: String, default: null, trim: true, index: true })
  expenseId?: string | null;

  @Prop({ type: String, default: null, index: true })
  paymentStatus?: string | null;

  @Prop({ type: String, required: true, trim: true, unique: true, index: true })
  dedupeKey!: string;

  @Prop({ type: Object, default: {} })
  meta?: Record<string, unknown>;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  updatedBy?: Types.ObjectId | null;
}

export const FinanceMovementSchema =
  SchemaFactory.createForClass(FinanceMovement);

FinanceMovementSchema.index({ businessId: 1, date: -1 });
FinanceMovementSchema.index({ businessId: 1, type: 1, date: -1 });
FinanceMovementSchema.index({ businessId: 1, direction: 1, date: -1 });
FinanceMovementSchema.index({ businessId: 1, source: 1, sourceId: 1 });