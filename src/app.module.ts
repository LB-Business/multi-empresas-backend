import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import appConfig from './config/app.config';
import authConfig from './config/auth.config';
import { AuthModule } from './modules/auth/auth.module';
import { BusinessesModule } from './modules/businesses/businesses.module';
import { ProductsModule } from './modules/products/products.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { UsersModule } from './modules/users/users.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { FinanceModule } from './modules/finance/finance.module';
import { MovementsModule } from './modules/movements/movements.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { MercadoLibreModule } from './modules/mercadolibre/mercadolibre.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, authConfig],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('app.mongoUri'),
      }),
    }),
    AuthModule,
    BusinessesModule,
    UsersModule,
    ProductsModule,
    UploadsModule,
    ExpensesModule,
    CalendarModule,
    FinanceModule,
    MovementsModule,
    PropertiesModule,
    MercadoLibreModule,
  ],
})
export class AppModule {}