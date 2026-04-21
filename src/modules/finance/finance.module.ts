import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Expense, ExpenseSchema } from '../expenses/schemas/expense.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import {
  FinanceMovement,
  FinanceMovementSchema,
} from './schema/finance-movement.schema';
import { MovementsModule } from '../movements/movements.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Expense.name, schema: ExpenseSchema },
      { name: Product.name, schema: ProductSchema },
      { name: FinanceMovement.name, schema: FinanceMovementSchema },
    ]),
    MovementsModule
  ],
  controllers: [FinanceController],
  providers: [FinanceService, RolesGuard],
  exports: [FinanceService, MongooseModule],
})
export class FinanceModule {}