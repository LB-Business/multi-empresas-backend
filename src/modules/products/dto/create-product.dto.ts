import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  ValidateNested,
} from 'class-validator';
import { Currency } from '../../../common/enums/currency.enum';
import { ProductStatus } from '../../../common/enums/product-status.enum';
import { ProductType } from '../../../common/enums/product-type.enum';
import { ProductOwnershipType } from '../schemas/product.schema';

export class ProductImageDto {
  @ApiProperty({
    example:
      'https://res.cloudinary.com/demo/image/upload/v123/products/demo/product.jpg',
  })
  @IsUrl()
  url!: string;

  @ApiProperty({
    example: 'products/demo/product',
  })
  @IsString()
  publicId!: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isCover?: boolean;
}

export class ProductVariantDto {
  @ApiPropertyOptional({ example: 'M' })
  @IsOptional()
  @IsString()
  size?: string;

  @ApiPropertyOptional({ example: 'Negro' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: 'REM-NEG-M' })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional({ example: 24999 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  salePrice?: number;

  @ApiProperty({ example: 5 })
  @IsNumber()
  @Min(0)
  stock!: number;
}

export class ProductExtraExpenseItemDto {
  @ApiProperty({ example: 'Batería' })
  @IsString()
  label!: string;

  @ApiProperty({ example: 50000 })
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({
    example: '2026-04-15T12:00:00.000Z',
    description: 'Fecha del gasto extra',
  })
  @IsOptional()
  @IsDateString()
  expenseDate?: string;
}

export class ProductVehicleDetailsDto {
  @ApiPropertyOptional({ example: 'Peugeot' })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({ example: '208' })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({ example: 'Allure' })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({ example: 2022 })
  @IsOptional()
  @IsInt()
  @Min(0)
  year?: number;

  @ApiPropertyOptional({ example: 54000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  kms?: number;

  @ApiPropertyOptional({ example: 'Nafta' })
  @IsOptional()
  @IsString()
  fuelType?: string;

  @ApiPropertyOptional({ example: 'Manual' })
  @IsOptional()
  @IsString()
  transmission?: string;

  @ApiPropertyOptional({ example: 'Negro' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: 'AB123CD' })
  @IsOptional()
  @IsString()
  plate?: string;
}

export class ProductReservationDto {
  @ApiPropertyOptional({
    example: 3000000,
    description: 'Monto de la seña',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  depositAmount?: number;

  @ApiPropertyOptional({
    enum: Currency,
    example: Currency.ARS,
    description: 'Moneda de la seña',
  })
  @IsOptional()
  @IsEnum(Currency)
  depositCurrency?: Currency;

  @ApiPropertyOptional({
    example: '2026-04-15T12:00:00.000Z',
    description: 'Fecha de la seña',
  })
  @IsOptional()
  @IsDateString()
  depositDate?: string;

  @ApiPropertyOptional({ example: 'Juan Pérez' })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional({ example: '5491112345678' })
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiPropertyOptional({ example: 'Seña recibida por transferencia' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ProductOwnershipDto {
  @ApiPropertyOptional({
    enum: ProductOwnershipType,
    example: ProductOwnershipType.OWNED,
    description:
      'Indica si el vehículo/producto es propio o entró en consignación',
  })
  @IsOptional()
  @IsEnum(ProductOwnershipType)
  ownershipType?: ProductOwnershipType;

  @ApiPropertyOptional({
    example: 18000000,
    description: 'Precio de compra si el producto fue comprado',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  purchasePrice?: number;

  @ApiPropertyOptional({
    example: '2026-04-10T12:00:00.000Z',
    description: 'Fecha de compra si el producto fue comprado',
  })
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @ApiPropertyOptional({
    example: 25000000,
    description:
      'Monto esperado para entregar al dueño si el producto está en consignación',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  ownerExpectedAmount?: number;

  @ApiPropertyOptional({
    example: 'Juan Pérez',
    description: 'Nombre del dueño consignante',
  })
  @IsOptional()
  @IsString()
  consignorName?: string;

  @ApiPropertyOptional({
    example: '5491112345678',
    description: 'Teléfono del dueño consignante',
  })
  @IsOptional()
  @IsString()
  consignorPhone?: string;
}

export class CreateProductDto {
  @ApiProperty({ example: 'Remera Oversize Negra' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'remera-oversize-negra' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ enum: ProductType, example: ProductType.GENERAL })
  @IsOptional()
  @IsEnum(ProductType)
  productType?: ProductType;

  @ApiPropertyOptional({ example: 'Remera de algodón premium' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 24999 })
  @IsNumber()
  @Min(0)
  salePrice!: number;

  @ApiProperty({ enum: Currency, example: Currency.ARS })
  @IsEnum(Currency)
  currency!: Currency;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({
    type: [ProductVariantDto],
    description: 'Variantes de ropa u otros productos con talle/color/stock',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants?: ProductVariantDto[];

  @ApiPropertyOptional({ example: 'Indumentaria' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: ['remera', 'oversize', 'negra'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    type: [ProductImageDto],
    example: [
      {
        url: 'https://res.cloudinary.com/demo/image/upload/v123/products/demo/product.jpg',
        publicId: 'products/demo/product',
        order: 0,
        isCover: true,
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  images?: ProductImageDto[];

  @ApiPropertyOptional({
    type: ProductVehicleDetailsDto,
    description: 'Campos especiales para productos tipo auto',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductVehicleDetailsDto)
  vehicleDetails?: ProductVehicleDetailsDto;

  @ApiPropertyOptional({
    type: ProductOwnershipDto,
    description:
      'Define si el producto/auto es propio o está en consignación, y sus datos asociados',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductOwnershipDto)
  ownership?: ProductOwnershipDto;

  @ApiPropertyOptional({
    type: ProductReservationDto,
    description: 'Datos de seña / reserva',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductReservationDto)
  reservation?: ProductReservationDto;

  @ApiPropertyOptional({ enum: ProductStatus, example: ProductStatus.DRAFT })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({
    example: '2026-04-20T12:00:00.000Z',
    description: 'Fecha de venta del producto',
  })
  @IsOptional()
  @IsDateString()
  soldAt?: string;

  @ApiPropertyOptional({
    example: 15000,
    description: 'Visible only to OWNER',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @ApiPropertyOptional({
    example: 26000,
    description: 'Visible only to OWNER',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedSalePrice?: number;

  @ApiPropertyOptional({
    example: 25500,
    description: 'Visible only to OWNER',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  finalSalePrice?: number;

  @ApiPropertyOptional({
    type: [ProductExtraExpenseItemDto],
    description: 'Lista de gastos extra. Visible only to OWNER',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductExtraExpenseItemDto)
  extraExpenseItems?: ProductExtraExpenseItemDto[];

  @ApiPropertyOptional({
    example: 1200,
    description:
      'Compatibilidad temporal con frontend viejo. Visible only to OWNER',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  extraExpenses?: number;

  @ApiPropertyOptional({
    example: 'Costo incluye packaging',
    description: 'Visible only to OWNER',
  })
  @IsOptional()
  @IsString()
  internalNotes?: string;
}