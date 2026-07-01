import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';

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

@ApiTags('Properties')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get()
  @ApiOperation({
    summary: 'List business properties for the current logged-in user',
  })
  findAll(
    @CurrentUserDecorator() currentUser: CurrentUser,
    @Query('status') status?: string,
    @Query('operationType') operationType?: string,
    @Query('propertyType') propertyType?: string,
    @Query('showOnLanding') showOnLanding?: string,
    @Query('search') search?: string,
  ) {
    const businessId = getBusinessIdFromCurrentUser(currentUser);

    return this.propertiesService.findAll(businessId, {
      status,
      operationType,
      propertyType,
      showOnLanding,
      search,
    });
  }

  @Post()
  @ApiOperation({ summary: 'Create a property' })
  create(
    @Body() dto: CreatePropertyDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    const businessId = getBusinessIdFromCurrentUser(currentUser);
    const userId = getUserIdFromCurrentUser(currentUser);

    return this.propertiesService.create(dto, businessId, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single property by id' })
  findOne(
    @Param('id') id: string,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    const businessId = getBusinessIdFromCurrentUser(currentUser);

    return this.propertiesService.findOne(id, businessId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a property' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePropertyDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    const businessId = getBusinessIdFromCurrentUser(currentUser);
    const userId = getUserIdFromCurrentUser(currentUser);

    return this.propertiesService.update(id, dto, businessId, userId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update property status' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    const businessId = getBusinessIdFromCurrentUser(currentUser);

    return this.propertiesService.updateStatus(id, status, businessId);
  }

  @Patch(':id/show-on-landing')
  @ApiOperation({ summary: 'Update property landing visibility' })
  updateShowOnLanding(
    @Param('id') id: string,
    @Body('showOnLanding') showOnLanding: boolean,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    const businessId = getBusinessIdFromCurrentUser(currentUser);

    return this.propertiesService.updateShowOnLanding(
      id,
      !!showOnLanding,
      businessId,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a property' })
  remove(
    @Param('id') id: string,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    const businessId = getBusinessIdFromCurrentUser(currentUser);

    return this.propertiesService.remove(id, businessId);
  }
}

@ApiTags('Public Properties')
@Controller('public/businesses')
export class PublicPropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get(':businessSlug/properties')
  @ApiOperation({
    summary: 'Public property list by business slug for landing page',
  })
  findPublicLandingByBusinessSlug(
    @Param('businessSlug') businessSlug: string,
  ) {
    return this.propertiesService.findPublicLandingByBusinessSlug(
      businessSlug,
    );
  }

  @Get(':businessSlug/properties/:propertySlug')
  @ApiOperation({
    summary: 'Public property detail by business slug and property slug',
  })
  findPublicLandingOneBySlug(
    @Param('businessSlug') businessSlug: string,
    @Param('propertySlug') propertySlug: string,
  ) {
    return this.propertiesService.findPublicLandingOneBySlug(
      businessSlug,
      propertySlug,
    );
  }
}