import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-businesses.dto';
import { UpdateBusinessStatusDto } from './dto/update-business-status.dto';
import { UpdateMyBusinessProfileDto } from './dto/update-my-business-profile.dto';
import { BusinessesService } from './businesses.service';

@ApiTags('Businesses')
@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  /**
   * Ruta pública para landing/storefront.
   * No usa JwtAuthGuard ni RolesGuard.
   *
   * URL final:
   * GET /api/businesses/public/:slug/profile
   *
   * Ejemplo:
   * GET /api/businesses/public/drops-market/profile
   */
  @Get('public/:slug/profile')
  @ApiOperation({
    summary: 'Get public business profile by slug',
  })
  getPublicBusinessProfile(@Param('slug') slug: string) {
    return this.businessesService.getPublicBusinessProfile(slug);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all businesses (SUPER_ADMIN only)' })
  findAll() {
    return this.businessesService.findAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a business (SUPER_ADMIN only)' })
  create(@Body() dto: CreateBusinessDto) {
    return this.businessesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update any business admin fields (SUPER_ADMIN only)' })
  updateById(@Param('id') id: string, @Body() dto: UpdateBusinessDto) {
    return this.businessesService.updateById(id, dto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Enable or disable a business (SUPER_ADMIN only)' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateBusinessStatusDto,
  ) {
    return this.businessesService.setActive(id, dto.isActive);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'Get current business profile' })
  getMyBusiness(@CurrentUserDecorator() currentUser: CurrentUser) {
    return this.businessesService.getMyBusiness(currentUser);
  }

  @Patch('me/profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update current business profile fields (OWNER/ADMIN only)',
  })
  updateMyBusinessProfile(
    @Body() dto: UpdateMyBusinessProfileDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.businessesService.updateMyBusinessProfile(dto, currentUser);
  }
}