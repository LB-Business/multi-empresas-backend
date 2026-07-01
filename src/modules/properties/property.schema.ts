import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PropertyDocument = HydratedDocument<Property>;

export type PropertyOperationType =
  | 'venta'
  | 'alquiler'
  | 'alquiler_temporario';

export type PropertyType =
  | 'casa'
  | 'departamento'
  | 'terreno'
  | 'local'
  | 'oficina'
  | 'galpon'
  | 'campo'
  | 'duplex'
  | 'ph'
  | 'otro';

export type PropertyStatus =
  | 'draft'
  | 'published'
  | 'paused'
  | 'sold'
  | 'rented'
  | 'archived';

@Schema({ _id: false })
export class PropertyImage {
  @Prop({ required: true })
  url!: string;

  @Prop({ required: true })
  publicId!: string;

  @Prop({ default: 0 })
  order!: number;

  @Prop({ default: false })
  isCover!: boolean;
}

export const PropertyImageSchema = SchemaFactory.createForClass(PropertyImage);

@Schema({ _id: false })
export class PropertyDocumentFile {
  @Prop({ default: 'Documento' })
  label!: string;

  @Prop({ default: 'otro' })
  type!: string;

  @Prop({ required: true })
  url!: string;

  @Prop({ required: true })
  publicId!: string;

  @Prop()
  fileName?: string;

  @Prop()
  mimeType?: string;

  @Prop({ type: Date, default: Date.now })
  uploadedAt?: Date;
}

export const PropertyDocumentFileSchema =
  SchemaFactory.createForClass(PropertyDocumentFile);

@Schema({ _id: false })
export class PropertyAddress {
  @Prop()
  street?: string;

  @Prop()
  number?: string;

  @Prop()
  neighborhood?: string;

  @Prop()
  city?: string;

  @Prop()
  state?: string;

  @Prop({ default: 'Argentina' })
  country?: string;

  @Prop()
  latitude?: number;

  @Prop()
  longitude?: number;

  @Prop({ default: false })
  showExactLocation?: boolean;
}

export const PropertyAddressSchema =
  SchemaFactory.createForClass(PropertyAddress);

@Schema({ _id: false })
export class PropertyFeatures {
  @Prop()
  totalArea?: number;

  @Prop()
  coveredArea?: number;

  @Prop()
  rooms?: number;

  @Prop()
  bedrooms?: number;

  @Prop()
  bathrooms?: number;

  @Prop()
  garages?: number;

  @Prop()
  age?: number;

  @Prop()
  floors?: number;

  @Prop({ default: false })
  hasPool?: boolean;

  @Prop({ default: false })
  hasGrill?: boolean;

  @Prop({ default: false })
  hasGarden?: boolean;

  @Prop({ default: false })
  hasSecurity?: boolean;

  @Prop({ default: false })
  hasElevator?: boolean;

  @Prop({ default: false })
  hasBalcony?: boolean;

  @Prop({ default: false })
  hasTerrace?: boolean;
}

export const PropertyFeaturesSchema =
  SchemaFactory.createForClass(PropertyFeatures);

@Schema({ _id: false })
export class PropertyMercadoLibre {
  @Prop()
  itemId?: string;

  @Prop()
  status?: string;

  @Prop()
  permalink?: string;

  @Prop()
  categoryId?: string;

  @Prop()
  listingTypeId?: string;

  @Prop()
  lastSyncAt?: Date;

  @Prop()
  publishedAt?: Date;

  @Prop()
  pausedAt?: Date;

  @Prop()
  errorMessage?: string;
}

export const PropertyMercadoLibreSchema =
  SchemaFactory.createForClass(PropertyMercadoLibre);

@Schema({ timestamps: true })
export class Property {
  @Prop({ type: Types.ObjectId, ref: 'Business', required: true, index: true })
  businessId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true, trim: true, lowercase: true })
  slug!: string;

  @Prop({ default: '' })
  description!: string;

  @Prop({
    enum: ['venta', 'alquiler', 'alquiler_temporario'],
    default: 'venta',
    index: true,
  })
  operationType!: PropertyOperationType;

  @Prop({
    enum: [
      'casa',
      'departamento',
      'terreno',
      'local',
      'oficina',
      'galpon',
      'campo',
      'duplex',
      'ph',
      'otro',
    ],
    default: 'casa',
    index: true,
  })
  propertyType!: PropertyType;

  @Prop({
    enum: ['draft', 'published', 'paused', 'sold', 'rented', 'archived'],
    default: 'draft',
    index: true,
  })
  status!: PropertyStatus;

  @Prop({ default: false, index: true })
  showOnLanding!: boolean;

  @Prop({ default: 0 })
  price!: number;

  @Prop({ enum: ['ARS', 'USD'], default: 'USD' })
  currency!: 'ARS' | 'USD';

  @Prop({ default: 0 })
  expenses!: number;

  @Prop({ default: false })
  acceptsFinancing!: boolean;

  @Prop({ default: false })
  acceptsExchange!: boolean;

  @Prop({ type: PropertyAddressSchema, default: {} })
  address!: PropertyAddress;

  @Prop({ type: PropertyFeaturesSchema, default: {} })
  features!: PropertyFeatures;

  @Prop({ type: [PropertyImageSchema], default: [] })
  images!: PropertyImage[];

  @Prop({ type: [PropertyDocumentFileSchema], default: [] })
  documents!: PropertyDocumentFile[];

  @Prop({ type: PropertyMercadoLibreSchema, default: {} })
  ml!: PropertyMercadoLibre;

  @Prop({ default: '' })
  internalNotes!: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;
}

export const PropertySchema = SchemaFactory.createForClass(Property);

PropertySchema.index({ businessId: 1, slug: 1 }, { unique: true });
PropertySchema.index({ businessId: 1, status: 1 });
PropertySchema.index({ businessId: 1, showOnLanding: 1 });
PropertySchema.index({ businessId: 1, operationType: 1 });
PropertySchema.index({ businessId: 1, propertyType: 1 });