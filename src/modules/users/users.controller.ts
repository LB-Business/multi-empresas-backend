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
import { CreateUserBySuperAdminDto } from './dto/create-user-by-super-admin.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { UpdateUserBySuperAdminDto } from './dto/update-user-by-super-admin.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'List users from the current business (OWNER only)',
  })
  findAll(@CurrentUserDecorator() currentUser: CurrentUser) {
    return this.usersService.findAllByBusiness(currentUser);
  }

  @Get('all')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all users (SUPER_ADMIN only)' })
  findAllGlobal() {
    return this.usersService.findAllGlobal();
  }

  @Get('business/:businessId')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'List users from a specific business (SUPER_ADMIN only)',
  })
  findAllByBusinessId(@Param('businessId') businessId: string) {
    return this.usersService.findAllByBusinessId(businessId);
  }

  @Post()
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'Create a new user inside the current business (OWNER only)',
  })
  create(
    @Body() dto: CreateUserDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.usersService.create(dto, currentUser);
  }

  @Post('by-super-admin')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Create a user for any business (SUPER_ADMIN only)',
  })
  createBySuperAdmin(@Body() dto: CreateUserBySuperAdminDto) {
    return this.usersService.createBySuperAdmin(dto);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Update user fields (OWNER only)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.usersService.update(id, dto, currentUser);
  }

  @Patch(':id/by-super-admin')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update any user (SUPER_ADMIN only)' })
  updateBySuperAdmin(
    @Param('id') id: string,
    @Body() dto: UpdateUserBySuperAdminDto,
  ) {
    return this.usersService.updateBySuperAdmin(id, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Enable or disable a user (OWNER only)' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.usersService.setActive(id, dto.isActive, currentUser);
  }

  @Patch(':id/status/by-super-admin')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Enable or disable any user (SUPER_ADMIN only)',
  })
  updateStatusBySuperAdmin(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.usersService.setActiveBySuperAdmin(id, dto.isActive);
  }

  @Patch(':id/reset-password')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Reset user password (SUPER_ADMIN only)' })
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetUserPasswordDto,
  ) {
    return this.usersService.resetPassword(id, dto.newPassword);
  }
}