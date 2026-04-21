import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BusinessDocument = HydratedDocument<Business>;

@Schema({ timestamps: true })
export class Business {
  createdAt?: Date;
  updatedAt?: Date;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug!: string;

  @Prop({ type: String, default: null })
  logoUrl?: string | null;

  @Prop({ type: String, default: null })
  contactPhone?: string | null;

  @Prop({ type: String, default: null })
  publicEmail?: string | null;

  @Prop({ type: String, default: null })
  address?: string | null;

  @Prop({ type: String, default: null })
  description?: string | null;

  @Prop({ type: String, default: null })
  domain?: string | null;

  @Prop({ type: String, default: null })
  businessType?: string | null;

  @Prop({ type: String, default: 'ARS' })
  currency!: string;

  @Prop({ type: String, default: 'America/Argentina/Buenos_Aires' })
  timezone!: string;

  @Prop({ type: String, default: null })
  primaryColor?: string | null;

  @Prop({ type: String, default: null })
  secondaryColor?: string | null;

  @Prop({ type: String, enum: ['free', 'basic', 'pro', 'enterprise'], default: 'free' })
  plan!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  ownerUserId?: Types.ObjectId | null;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ type: String, default: 'internal', index: true })
  source?: 'internal' | 'public_booking';

  @Prop({ type: String, default: null, trim: true })
  contactEmail?: string | null;

  @Prop({ type: String, default: null, trim: true })
  bookingDate?: string | null;

  @Prop({ type: String, default: null, trim: true })
  bookingStartTime?: string | null;

  @Prop({ type: String, default: null, trim: true })
  bookingEndTime?: string | null;
}

export const BusinessSchema = SchemaFactory.createForClass(Business);