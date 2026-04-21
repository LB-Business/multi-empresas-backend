import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { BusinessesModule } from '../businesses/businesses.module';
import { User, UserSchema } from './schemas/user.schema';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    BusinessesModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, RolesGuard],
  exports: [UsersService, MongooseModule],
})
export class UsersModule {}