import {
  IsArray,
  IsBoolean,
  IsIn,
  IsMongoId,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class PropertyImageDto {
  @IsString()
  url!: string;

  @IsString()
  publicId!: string;

  @IsOptional()
  @IsNumber()
  order?: number;

  @IsOptional()
  @IsBoolean()
  isCover?: boolean;
}

class PropertyDocumentDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsString()
  url!: string;

  @IsString()
  publicId!: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsString()
  uploadedAt?: string;
}

class PropertyAddressDto {
  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  number?: string;

  @IsOptional()
  @IsString()
  neighborhood?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsBoolean()
  showExactLocation?: boolean;
}

class PropertyFeaturesDto {
  @IsOptional()
  @IsNumber()
  totalArea?: number;

  @IsOptional()
  @IsNumber()
  coveredArea?: number;

  @IsOptional()
  @IsNumber()
  rooms?: number;

  @IsOptional()
  @IsNumber()
  bedrooms?: number;

  @IsOptional()
  @IsNumber()
  bathrooms?: number;

  @IsOptional()
  @IsNumber()
  garages?: number;

  @IsOptional()
  @IsNumber()
  age?: number;

  @IsOptional()
  @IsNumber()
  floors?: number;

  @IsOptional()
  @IsBoolean()
  hasPool?: boolean;

  @IsOptional()
  @IsBoolean()
  hasGrill?: boolean;

  @IsOptional()
  @IsBoolean()
  hasGarden?: boolean;

  @IsOptional()
  @IsBoolean()
  hasSecurity?: boolean;

  @IsOptional()
  @IsBoolean()
  hasElevator?: boolean;

  @IsOptional()
  @IsBoolean()
  hasBalcony?: boolean;

  @IsOptional()
  @IsBoolean()
  hasTerrace?: boolean;
}

export class CreatePropertyDto {
  @IsOptional()
  @IsMongoId()
  businessId?: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['venta', 'alquiler', 'alquiler_temporario'])
  operationType?: 'venta' | 'alquiler' | 'alquiler_temporario';

  @IsOptional()
  @IsIn([
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
  ])
  propertyType?:
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

  @IsOptional()
  @IsIn(['draft', 'published', 'paused', 'sold', 'rented', 'archived'])
  status?: 'draft' | 'published' | 'paused' | 'sold' | 'rented' | 'archived';

  @IsOptional()
  @IsBoolean()
  showOnLanding?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsIn(['ARS', 'USD'])
  currency?: 'ARS' | 'USD';

  @IsOptional()
  @IsNumber()
  @Min(0)
  expenses?: number;

  @IsOptional()
  @IsBoolean()
  acceptsFinancing?: boolean;

  @IsOptional()
  @IsBoolean()
  acceptsExchange?: boolean;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PropertyAddressDto)
  address?: PropertyAddressDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PropertyFeaturesDto)
  features?: PropertyFeaturesDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PropertyImageDto)
  images?: PropertyImageDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PropertyDocumentDto)
  documents?: PropertyDocumentDto[];

  @IsOptional()
  @IsString()
  internalNotes?: string;
}