import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Property, PropertySchema } from './property.schema';
import {
  PropertiesController,
  PublicPropertiesController,
} from './properties.controller';
import { PropertiesService } from './properties.service';
import { MercadoLibreModule } from '../mercadolibre/mercadolibre.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Property.name,
        schema: PropertySchema,
      },
    ]),
    MercadoLibreModule,
  ],
  controllers: [PropertiesController, PublicPropertiesController],
  providers: [PropertiesService],
  exports: [PropertiesService],
})
export class PropertiesModule {}