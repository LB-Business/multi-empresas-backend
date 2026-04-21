import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductStatus } from '../../../common/enums/product-status.enum';
import { ProductReservationDto } from './create-product.dto';

export class UpdateProductStatusDto {
  @ApiProperty({ enum: ProductStatus, example: ProductStatus.PUBLISHED })
  @IsEnum(ProductStatus)
  status!: ProductStatus;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({
    type: ProductReservationDto,
    description: 'Datos de seña / reserva al marcar como reserved',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductReservationDto)
  reservation?: ProductReservationDto;

  @ApiPropertyOptional({
    example: 27500000,
    description: 'Precio final real de venta',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  finalSalePrice?: number;

  @ApiPropertyOptional({
    example: '2026-04-20T12:00:00.000Z',
    description: 'Fecha de venta al marcar como sold',
  })
  @IsOptional()
  @IsDateString()
  soldAt?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Borra la seña/reserva al volver el producto a publicado',
  })
  @IsOptional()
  @IsBoolean()
  clearReservation?: boolean;

  @ApiPropertyOptional({
    example: 0,
    description: 'Índice de la variante a vender',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  variantIndex?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Cantidad de unidades a vender de la variante',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}