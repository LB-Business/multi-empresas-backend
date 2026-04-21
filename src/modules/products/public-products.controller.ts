import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProductsService } from './products.service';

@ApiTags('Public')
@Controller('public')
export class PublicProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get(':slug/products')
  @ApiOperation({
    summary: 'Public endpoint to list published products by business slug',
  })
  findBySlug(@Param('slug') slug: string) {
    return this.productsService.findPublicProductsBySlug(slug);
  }

  @Get(':slug/products/:productId')
  @ApiOperation({
    summary: 'Public endpoint to get published product detail by business slug',
  })
  findOneBySlug(
    @Param('slug') slug: string,
    @Param('productId') productId: string,
  ) {
    return this.productsService.findPublicProductBySlug(slug, productId);
  }
}