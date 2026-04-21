import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Expense, ExpenseSchema } from './schemas/expense.schema';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { MovementsModule } from '../movements/movements.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Expense.name, schema: ExpenseSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
    MovementsModule,
  ],
  controllers: [ExpensesController],
  providers: [ExpensesService, RolesGuard],
  exports: [ExpensesService, MongooseModule],
})
export class ExpensesModule {}