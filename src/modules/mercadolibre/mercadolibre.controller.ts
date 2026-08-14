import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UseGuards,
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
  `${frontendUrl}/dashboard/settings?mercadolibre=connected`
);
  }

  @Get('questions')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List Mercado Libre questions saved in CRM' })
  async listQuestions(
    @CurrentUserDecorator() currentUser: CurrentUser,
    @Query('status') status?: string,
    @Query('itemId') itemId?: string,
    @Query('propertyId') propertyId?: string,
    @Query('sync') sync?: string,
    @Query('limit') limit?: string,
  ) {
    const businessId = getBusinessIdFromCurrentUser(currentUser);

    return this.mercadoLibreService.listQuestions(businessId, {
      status,
      itemId,
      propertyId,
      sync: sync === 'true' || sync === '1',
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('questions/sync')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Sync Mercado Libre questions from API' })
  async syncQuestions(
    @CurrentUserDecorator() currentUser: CurrentUser,
    @Body() body: any,
  ) {
    const businessId = getBusinessIdFromCurrentUser(currentUser);

    return this.mercadoLibreService.syncQuestionsByBusiness(businessId, {
      status: body?.status,
      itemId: body?.itemId,
    });
  }

  @Get('questions/:questionId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get one Mercado Libre question from CRM' })
  async getQuestion(
    @CurrentUserDecorator() currentUser: CurrentUser,
    @Param('questionId') questionId: string,
  ) {
    const businessId = getBusinessIdFromCurrentUser(currentUser);

    return this.mercadoLibreService.getQuestion(businessId, questionId);
  }

  @Post('questions/:questionId/answer')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Answer Mercado Libre question from CRM' })
  async answerQuestion(
    @CurrentUserDecorator() currentUser: CurrentUser,
    @Param('questionId') questionId: string,
    @Body('text') text: string,
  ) {
    const businessId = getBusinessIdFromCurrentUser(currentUser);

    return this.mercadoLibreService.answerQuestion(
      businessId,
      questionId,
      text,
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
