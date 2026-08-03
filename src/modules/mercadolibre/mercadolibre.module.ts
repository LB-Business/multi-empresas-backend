import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  MercadoLibreAccount,
  MercadoLibreAccountSchema,
} from './mercadolibre-account.schema';
import {
  MercadoLibreQuestion,
  MercadoLibreQuestionSchema,
} from './mercadolibre-question.schema';
import { MercadoLibreController } from './mercadolibre.controller';
import { MercadoLibreService } from './mercadolibre.service';
import { Property, PropertySchema } from '../properties/property.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: MercadoLibreAccount.name,
        schema: MercadoLibreAccountSchema,
      },
      {
        name: MercadoLibreQuestion.name,
        schema: MercadoLibreQuestionSchema,
      },
      {
        name: Property.name,
        schema: PropertySchema,
      },
    ]),
  ],
  controllers: [MercadoLibreController],
  providers: [MercadoLibreService],
  exports: [MercadoLibreService],
})
export class MercadoLibreModule {}
