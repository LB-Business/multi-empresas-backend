import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class MercadoLibreAttributeDto {
  @IsString()
  id!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  value_id?: string;

  @IsOptional()
  @IsString()
  value_name?: string;

  @IsOptional()
  value_struct?: any;

  @IsOptional()
  values?: any[];

  @IsOptional()
  @IsString()
  attribute_group_id?: string;

  @IsOptional()
  @IsString()
  attribute_group_name?: string;

  @IsOptional()
  @IsString()
  value_type?: string;
}

export class PublishPropertyMercadoLibreDto {
  @IsString()
  categoryId!: string;

  @IsOptional()
  @IsIn(['silver', 'gold', 'gold_premium'])
  listingTypeId?: 'silver' | 'gold' | 'gold_premium';

  @IsOptional()
  @IsIn(['buy_it_now', 'classified', 'auction'])
  buyingMode?: 'buy_it_now' | 'classified' | 'auction';

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsIn(['ARS', 'USD'])
  currencyId?: 'ARS' | 'USD';

  @IsOptional()
  @IsIn(['new', 'used'])
  condition?: 'new' | 'used';

  @IsOptional()
  @IsObject()
  location?: any;

  @IsOptional()
  @IsArray()
  attributes?: MercadoLibreAttributeDto[];

  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @IsOptional()
  @IsBoolean()
  testMode?: boolean;
}