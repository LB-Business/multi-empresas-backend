import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Currency } from 'src/common/enums/currency.enum';
import { ProductStatus } from 'src/common/enums/product-status.enum';
import { ProductType } from 'src/common/enums/product-type.enum';

export type ProductDocument = HydratedDocument<Product>;

export enum ProductOwnershipType {
  OWNED = 'owned',
  CONSIGNMENT = 'consignment',
}

@Schema({ _id: false })
export class ProductExtraExpenseItem {
  @Prop({ type: String, required: true, trim: true })
  label!: string;

  @Prop({ type: Number, required: true, min: 0 })
  amount!: number;

  @Prop({ type: Date, default: null })
  expenseDate?: Date | null;
}

const ProductExtraExpenseItemSchema =
  SchemaFactory.createForClass(ProductExtraExpenseItem);

@Schema({ _id: false })
export class ProductFinance {
  @Prop({ type: Number, default: null, min: 0 })
  costPrice?: number | null;

  @Prop({ type: Number, default: null, min: 0 })
  estimatedSalePrice?: number | null;

  @Prop({ type: Number, default: null, min: 0 })
  finalSalePrice?: number | null;

  @Prop({ type: [ProductExtraExpenseItemSchema], default: [] })
  extraExpenseItems!: ProductExtraExpenseItem[];

  @Prop({ type: String, default: null })
  internalNotes?: string | null;
}

const ProductFinanceSchema = SchemaFactory.createForClass(ProductFinance);

@Schema({ _id: false })
export class ProductImage {
  @Prop({ type: String, required: true, trim: true })
  url!: string;

  @Prop({ type: String, required: true, trim: true })
  publicId!: string;

  @Prop({ type: Number, default: 0, min: 0 })
  order!: number;

  @Prop({ type: Boolean, default: false })
  isCover!: boolean;
}

const ProductImageSchema = SchemaFactory.createForClass(ProductImage);

@Schema({ _id: false })
export class ProductVehicleDetails {
  @Prop({ type: String, default: null, trim: true })
  brand?: string | null;

  @Prop({ type: String, default: null, trim: true })
  model?: string | null;

  @Prop({ type: String, default: null, trim: true })
  version?: string | null;

  @Prop({ type: Number, default: null, min: 0 })
  year?: number | null;

  @Prop({ type: Number, default: null, min: 0 })
  kms?: number | null;

  @Prop({ type: String, default: null, trim: true })
  fuelType?: string | null;

  @Prop({ type: String, default: null, trim: true })
  transmission?: string | null;

  @Prop({ type: String, default: null, trim: true })
  color?: string | null;

  @Prop({ type: String, default: null, trim: true })
  plate?: string | null;
}

const ProductVehicleDetailsSchema =
  SchemaFactory.createForClass(ProductVehicleDetails);

@Schema({ _id: false })
export class ProductVariant {
  @Prop({ type: String, default: null, trim: true })
  size?: string | null;

  @Prop({ type: String, default: null, trim: true })
  color?: string | null;

  @Prop({ type: String, default: null, trim: true })
  sku?: string | null;

  @Prop({ type: Number, default: null, min: 0 })
  salePrice?: number | null;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  stock!: number;
}

const ProductVariantSchema = SchemaFactory.createForClass(ProductVariant);

@Schema({ _id: false })
export class ProductReservation {
  @Prop({ type: Number, default: null, min: 0 })
  depositAmount?: number | null;

  @Prop({ type: String, enum: Currency, default: null })
  depositCurrency?: Currency | null;

  @Prop({ type: Date, default: null })
  depositDate?: Date | null;

  @Prop({ type: String, default: null, trim: true })
  customerName?: string | null;

  @Prop({ type: String, default: null, trim: true })
  customerPhone?: string | null;

  @Prop({ type: String, default: null, trim: true })
  notes?: string | null;
}

const ProductReservationSchema =
  SchemaFactory.createForClass(ProductReservation);

@Schema({ _id: false })
export class ProductOwnershipDetails {
  @Prop({
    type: String,
    enum: ProductOwnershipType,
    default: ProductOwnershipType.OWNED,
  })
  ownershipType!: ProductOwnershipType;

  @Prop({ type: Number, default: null, min: 0 })
  purchasePrice?: number | null;

  @Prop({ type: Date, default: null })
  purchaseDate?: Date | null;

  @Prop({ type: Number, default: null, min: 0 })
  ownerExpectedAmount?: number | null;

  @Prop({ type: String, default: null, trim: true })
  consignorName?: string | null;

  @Prop({ type: String, default: null, trim: true })
  consignorPhone?: string | null;
}

const ProductOwnershipDetailsSchema =
  SchemaFactory.createForClass(ProductOwnershipDetails);

@Schema({ timestamps: true })
export class Product {
  createdAt?: Date;
  updatedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Business', required: true, index: true })
  businessId!: Types.ObjectId;

  @Prop({ required: true, trim: true, index: true })
  name!: string;

  @Prop({ required: true, trim: true, lowercase: true })
  slug!: string;

  @Prop({
    type: String,
    enum: ProductType,
    default: ProductType.GENERAL,
    index: true,
  })
  productType!: ProductType;

  @Prop({ type: String, default: null, trim: true })
  description?: string | null;

  @Prop({ required: true, min: 0 })
  salePrice!: number;

  @Prop({
    type: String,
    enum: Currency,
    required: true,
    default: Currency.ARS,
  })
  currency!: Currency;

  @Prop({ type: Number, default: 0, min: 0 })
  stock!: number;

  @Prop({ type: String, default: null, trim: true, index: true })
  category?: string | null;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ type: [ProductImageSchema], default: [] })
  images!: ProductImage[];

  @Prop({ type: [ProductVariantSchema], default: [] })
  variants!: ProductVariant[];

  @Prop({
    type: ProductVehicleDetailsSchema,
    default: null,
  })
  vehicleDetails?: ProductVehicleDetails | null;

  @Prop({
    type: ProductOwnershipDetailsSchema,
    default: {},
  })
  ownership!: ProductOwnershipDetails;

  @Prop({
    type: String,
    enum: ProductStatus,
    default: ProductStatus.DRAFT,
    index: true,
  })
  status!: ProductStatus;

  @Prop({ type: Boolean, default: false, index: true })
  isPublished!: boolean;

  @Prop({ type: Date, default: null, index: true })
  publishedAt?: Date | null;

  @Prop({ type: Date, default: null, index: true })
  soldAt?: Date | null;

  @Prop({ type: ProductReservationSchema, default: {} })
  reservation!: ProductReservation;

  @Prop({ type: ProductFinanceSchema, default: {} })
  finance!: ProductFinance;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  updatedBy?: Types.ObjectId | null;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.index({ businessId: 1, slug: 1 }, { unique: true });
ProductSchema.index({ businessId: 1, status: 1 });
ProductSchema.index({ businessId: 1, isPublished: 1 });
ProductSchema.index({ businessId: 1, category: 1 });
ProductSchema.index({ businessId: 1, salePrice: 1 });
ProductSchema.index({ businessId: 1, productType: 1 });
ProductSchema.index({ businessId: 1, 'ownership.ownershipType': 1 });
ProductSchema.index({ businessId: 1, createdAt: -1 });
ProductSchema.index({ businessId: 1, publishedAt: -1 });
ProductSchema.index({ businessId: 1, soldAt: -1 });