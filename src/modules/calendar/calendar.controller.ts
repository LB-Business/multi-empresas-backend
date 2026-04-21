import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CalendarService } from './calendar.service';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { FindCalendarEventsDto } from './dto/find-calendar-events.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { UpdateCalendarSettingsDto } from './dto/update-calendar-settings.dto';

@ApiTags('Calendar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'List calendar events from current business' })
  findAll(
    @Query() query: FindCalendarEventsDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.calendarService.findAll(currentUser, query);
  }

  @Get('settings')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get calendar booking settings' })
  getSettings(@CurrentUserDecorator() currentUser: CurrentUser) {
    return this.calendarService.getSettings(currentUser);
  }

  @Put('settings')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update calendar booking settings' })
  updateSettings(
    @Body() dto: UpdateCalendarSettingsDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.calendarService.updateSettings(dto, currentUser);
  }

  @Get('upcoming')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'List upcoming calendar events' })
  findUpcoming(@CurrentUserDecorator() currentUser: CurrentUser) {
    return this.calendarService.findUpcoming(currentUser);
  }

  @Get('day-summary')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({
    summary:
      'Get all events and business/financial movements for a specific day',
  })
  getDaySummary(
    @Query('date') date: string,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.calendarService.getDaySummary(currentUser, date);
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'Get one calendar event by id' })
  findOne(
    @Param('id') id: string,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.calendarService.findOne(id, currentUser);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create calendar event' })
  create(
    @Body() dto: CreateCalendarEventDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.calendarService.create(dto, currentUser);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update calendar event' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCalendarEventDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.calendarService.update(id, dto, currentUser);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete calendar event' })
  remove(
    @Param('id') id: string,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.calendarService.remove(id, currentUser);
  }
}