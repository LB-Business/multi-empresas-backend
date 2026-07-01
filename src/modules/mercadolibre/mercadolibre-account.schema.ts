import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MercadoLibreAccountDocument =
  HydratedDocument<MercadoLibreAccount>;

@Schema({
  timestamps: true,
  collection: 'mercadolibre_accounts',
})
export class MercadoLibreAccount {
  @Prop({
    type: Types.ObjectId,
    ref: 'Business',
    required: true,
    unique: true,
    index: true,
  })
  businessId!: Types.ObjectId;

  @Prop({ required: true, index: true })
  mlUserId!: number;

  @Prop()
  nickname?: string;

  @Prop()
  firstName?: string;

  @Prop()
  lastName?: string;

  @Prop()
  email?: string;

  @Prop({ default: 'MLA' })
  siteId!: string;

  @Prop({ required: true })
  accessToken!: string;

  @Prop({ required: true })
  refreshToken!: string;

  @Prop()
  tokenType?: string;

  @Prop()
  scope?: string;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop({ default: true, index: true })
  isActive!: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  connectedBy?: Types.ObjectId;

  @Prop()
  connectedAt?: Date;

  @Prop()
  disconnectedAt?: Date;

  @Prop()
  lastTokenRefreshAt?: Date;

  @Prop()
  lastSyncAt?: Date;
}

export const MercadoLibreAccountSchema =
  SchemaFactory.createForClass(MercadoLibreAccount);

MercadoLibreAccountSchema.index({ businessId: 1 }, { unique: true });
MercadoLibreAccountSchema.index({ mlUserId: 1 });