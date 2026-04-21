import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { IsDate } from 'class-validator';
import { Document } from 'mongoose';

export type MovementDocument = Movement & Document;

@Schema({ timestamps: true })
export class Movement {
  @Prop({ required: true, index: true })
  id?: string;

  @Prop({ required: true, index: true })
  type?: string;

  @Prop({ required: true })
  title?: string;

  @Prop()
  description?: string;

  @Prop({ type: Object, default: {} })
  meta?: Record<string, any>;

  @Prop({ default: null })
  amount?: number;

  @Prop({ enum: ['in', 'out', 'neutral'], default: 'neutral', index: true })
  direction?: 'in' | 'out' | 'neutral';

  @Prop({ type: Date, required: true, index: true })
  date?: Date;

  @Prop({ required: true, index: true })
  businessId?: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  @IsDate()
  updatedAt?: Date;
}

export const MovementSchema = SchemaFactory.createForClass(Movement);

MovementSchema.index({ businessId: 1, date: -1 });
MovementSchema.index({ businessId: 1, type: 1, date: -1 });
MovementSchema.index({ businessId: 1, direction: 1, date: -1 });