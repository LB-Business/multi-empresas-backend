import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BusinessesModule } from '../businesses/businesses.module';
import { Expense, ExpenseSchema } from '../expenses/schemas/expense.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { CalendarController } from './calendar.controller';
import { PublicCalendarController } from './public-calendar.controller';
import { CalendarService } from './calendar.service';
import {
  CalendarEvent,
  CalendarEventSchema,
} from './schemas/calendar-event.schema';
import {
  CalendarSettings,
  CalendarSettingsSchema,
} from './schemas/calendar-settings.schema';

@Module({
  imports: [
    BusinessesModule,
    MongooseModule.forFeature([
      { name: CalendarEvent.name, schema: CalendarEventSchema },
      { name: CalendarSettings.name, schema: CalendarSettingsSchema },
      { name: Expense.name, schema: ExpenseSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
  ],
  controllers: [CalendarController, PublicCalendarController],
  providers: [CalendarService, RolesGuard],
  exports: [CalendarService, MongooseModule],
})
export class CalendarModule {}