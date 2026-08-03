import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MercadoLibreQuestionDocument = HydratedDocument<MercadoLibreQuestion>;

@Schema({ timestamps: true })
export class MercadoLibreQuestion {
  @Prop({ type: Types.ObjectId, ref: 'Business', required: true, index: true })
  businessId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Property', index: true })
  propertyId?: Types.ObjectId;

  @Prop({ required: true, index: true })
  mlQuestionId!: number;

  @Prop({ required: true, index: true })
  mlItemId!: string;

  @Prop({ index: true })
  sellerId?: number;

  @Prop()
  buyerId?: number;

  @Prop({ default: '' })
  buyerNickname?: string;

  @Prop({ default: '' })
  text!: string;

  @Prop({ default: 'UNANSWERED', index: true })
  status!: string;

  @Prop({ default: '' })
  answerText?: string;

  @Prop()
  answeredAt?: Date;

  @Prop({ index: true })
  dateCreated?: Date;

  @Prop()
  lastSyncedAt?: Date;

  @Prop({ type: Object })
  raw?: any;

  @Prop({ type: Object })
  rawAnswer?: any;
}

export const MercadoLibreQuestionSchema =
  SchemaFactory.createForClass(MercadoLibreQuestion);

MercadoLibreQuestionSchema.index(
  { businessId: 1, mlQuestionId: 1 },
  { unique: true },
);
MercadoLibreQuestionSchema.index({ businessId: 1, status: 1, dateCreated: -1 });
MercadoLibreQuestionSchema.index({ businessId: 1, mlItemId: 1 });
MercadoLibreQuestionSchema.index({ businessId: 1, propertyId: 1 });
