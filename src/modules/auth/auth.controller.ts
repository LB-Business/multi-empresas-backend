import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { BootstrapSuperAdminDto } from './dto/bootstrap-super-admin.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterOwnerDto } from './dto/register-owner.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('bootstrap-super-admin')
  @ApiOperation({
    summary:
      'Bootstrap the very first SUPER_ADMIN using x-bootstrap-key header',
  })
  bootstrapSuperAdmin(
    @Body() dto: BootstrapSuperAdminDto,
    @Headers('x-bootstrap-key') bootstrapKey?: string,
  ) {
    return this.authService.bootstrapSuperAdmin(dto, bootstrapKey);
  }

  @Post('register-owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Create a business and its first OWNER user (SUPER_ADMIN only)',
  })
  registerOwner(@Body() dto: RegisterOwnerDto) {
    return this.authService.registerOwner(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @ApiOperation({
    summary: 'Exchange a refresh token for a new access token pair',
  })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current logged-in user' })
  async me(@CurrentUserDecorator() user: CurrentUser) {
    const fullUser = await this.usersService.findById(user.sub);

    return {
      user: this.usersService.toSafeUser(fullUser),
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invalidate current session refresh token' })
  logout(@CurrentUserDecorator() user: CurrentUser) {
    return this.authService.logout(user.sub);
  }
}