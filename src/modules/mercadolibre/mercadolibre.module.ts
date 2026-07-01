import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  MercadoLibreAccount,
  MercadoLibreAccountSchema,
} from './mercadolibre-account.schema';
import { MercadoLibreController } from './mercadolibre.controller';
import { MercadoLibreService } from './mercadolibre.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: MercadoLibreAccount.name,
        schema: MercadoLibreAccountSchema,
      },
    ]),
  ],
  controllers: [MercadoLibreController],
  providers: [MercadoLibreService],
  exports: [MercadoLibreService],
})
export class MercadoLibreModule {}