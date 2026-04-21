import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CalendarService } from './calendar.service';
import { CreatePublicBookingDto } from './dto/create-public-booking.dto';

@ApiTags('Public Calendar')
@Controller('public/:slug/turnos')
export class PublicCalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('settings')
  @ApiOperation({ summary: 'Get public booking settings by business slug' })
  getSettings(@Param('slug') slug: string) {
    return this.calendarService.getPublicBookingSettingsBySlug(slug);
  }

  @Get('disponibilidad')
  @ApiOperation({ summary: 'Get public booking availability by date' })
  getAvailability(
    @Param('slug') slug: string,
    @Query('date') date: string,
  ) {
    return this.calendarService.getPublicAvailabilityBySlug(slug, date);
  }

  @Post()
  @ApiOperation({ summary: 'Create public booking' })
  createBooking(
    @Param('slug') slug: string,
    @Body() dto: CreatePublicBookingDto,
  ) {
    return this.calendarService.createPublicBookingBySlug(slug, dto);
  }
}