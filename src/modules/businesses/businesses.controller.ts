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
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/common/enums/user-role.enum';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-businesses.dto';
import { UpdateBusinessStatusDto } from './dto/update-business-status.dto';
import { UpdateMyBusinessProfileDto } from './dto/update-my-business-profile.dto';
import { BusinessesService } from './businesses.service';

@ApiTags('Businesses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all businesses (SUPER_ADMIN only)' })
  findAll() {
    return this.businessesService.findAll();
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a business (SUPER_ADMIN only)' })
  create(@Body() dto: CreateBusinessDto) {
    return this.businessesService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update any business admin fields (SUPER_ADMIN only)' })
  updateById(@Param('id') id: string, @Body() dto: UpdateBusinessDto) {
    return this.businessesService.updateById(id, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Enable or disable a business (SUPER_ADMIN only)' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateBusinessStatusDto,
  ) {
    return this.businessesService.setActive(id, dto.isActive);
  }

  @Get('me')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'Get current business profile' })
  getMyBusiness(@CurrentUserDecorator() currentUser: CurrentUser) {
    return this.businessesService.getMyBusiness(currentUser);
  }

  @Patch('me/profile')
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