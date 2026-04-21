import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({
    summary: 'List business products for the current logged-in user',
  })
  findAll(@CurrentUserDecorator() currentUser: CurrentUser) {
    return this.productsService.findAllAdmin(currentUser);
  }

  @Post()
  @ApiOperation({ summary: 'Create a product' })
  create(
    @Body() dto: CreateProductDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.productsService.create(dto, currentUser);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single product by id' })
  findOne(
    @Param('id') id: string,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.productsService.findOneAdmin(id, currentUser);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a product' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.productsService.update(id, dto, currentUser);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update product publication / status' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateProductStatusDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.productsService.updateStatus(id, dto, currentUser);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a product' })
  remove(
    @Param('id') id: string,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.productsService.remove(id, currentUser);
  }
}