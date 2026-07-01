import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Property,
  PropertySchema,
} from './property.schema';
import {
  PropertiesController,
  PublicPropertiesController,
} from './properties.controller';
import { PropertiesService } from './properties.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Property.name,
        schema: PropertySchema,
      },
    ]),
  ],
  controllers: [PropertiesController, PublicPropertiesController],
  providers: [PropertiesService],
  exports: [PropertiesService],
})
export class PropertiesModule {}