import {
  Controller,
  Delete,
  Get,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UseGuards,
  Body,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MercadoLibreService } from './mercadolibre.service';

function getBusinessIdFromCurrentUser(currentUser: CurrentUser) {
  const user = currentUser as any;

  const businessId =
    user?.businessId ||
    user?.business ||
    user?.business?._id ||
    user?.payload?.businessId ||
    user?.user?.businessId;

  if (!businessId) {
    throw new UnauthorizedException('No se pudo resolver el negocio');
  }

  if (typeof businessId === 'object' && businessId.$oid) {
    return String(businessId.$oid);
  }

  return String(businessId);
}

function getUserIdFromCurrentUser(currentUser: CurrentUser) {
  const user = currentUser as any;

  return String(user?._id || user?.id || user?.sub || '');
}

@ApiTags('Mercado Libre')
@Controller('mercadolibre')
export class MercadoLibreController {
  constructor(private readonly mercadoLibreService: MercadoLibreService) {}

  @Get('auth-url')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get Mercado Libre OAuth URL' })
  getAuthUrl(@CurrentUserDecorator() currentUser: CurrentUser) {
    const businessId = getBusinessIdFromCurrentUser(currentUser);
    const userId = getUserIdFromCurrentUser(currentUser);

    return this.mercadoLibreService.buildAuthUrl(businessId, userId);
  }

  @Get('account')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get connected Mercado Libre account' })
  getAccount(@CurrentUserDecorator() currentUser: CurrentUser) {
    const businessId = getBusinessIdFromCurrentUser(currentUser);

    return this.mercadoLibreService.getAccountByBusiness(businessId);
  }

  @Delete('account')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Disconnect Mercado Libre account' })
  disconnect(@CurrentUserDecorator() currentUser: CurrentUser) {
    const businessId = getBusinessIdFromCurrentUser(currentUser);

    return this.mercadoLibreService.disconnectAccount(businessId);
  }

  @Get('callback')
  @ApiOperation({ summary: 'Mercado Libre OAuth callback' })
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    await this.mercadoLibreService.handleCallback(code, state);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';

    return res.redirect(
      `${frontendUrl}/dashboard/properties?ml=connected`,
    );
  }

  @Post('notifications')
  @ApiOperation({ summary: 'Mercado Libre notifications webhook' })
  notifications(@Body() body: any, @Query() query: any) {
    return this.mercadoLibreService.handleNotification(body, query);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Mercado Libre notifications health check' })
  notificationsHealth() {
    return {
      ok: true,
      service: 'mercadolibre-notifications',
    };
  }
}