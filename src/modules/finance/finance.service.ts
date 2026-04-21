import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Expense, ExpenseDocument } from '../expenses/schemas/expense.schema';
import {
  Product,
  ProductDocument,
  ProductOwnershipType,
} from '../products/schemas/product.schema';
import {
  FinanceMovement,
  FinanceMovementDirection,
  FinanceMovementDocument,
  FinanceMovementType,
} from './schema/finance-movement.schema';
import { CurrentUser } from '../../common/interfaces/current-user.interface';

type FinanceSummary = {
  period: {
    month: string;
    start: Date;
    end: Date;
  };
  totals: {
    income: number;
    expenses: number;
    balance: number;
    salesIncome: number;
    depositsIncome: number;
    manualExpenses: number;
    productExtraExpenses: number;
    vehiclePurchases: number;
    consignmentSettlements: number;
  };
  productStats: {
    publishedCount: number;
    reservedCount: number;
    soldCount: number;
    ownedCount: number;
    consignmentCount: number;
    estimatedProfit: number;
    realProfit: number;
  };
};

@Injectable()
export class FinanceService {
  constructor(
    @InjectModel(Expense.name)
    private readonly expenseModel: Model<ExpenseDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(FinanceMovement.name)
    private readonly financeMovementModel: Model<FinanceMovementDocument>,
  ) {}

  async syncMovements(currentUser: CurrentUser, month?: string) {
    this.ensureBusinessContext(currentUser);

    const { start, end } = this.getMonthRange(month);
    const businessId = this.toObjectId(currentUser.businessId, 'businessId');
    const userId = this.toObjectId(currentUser.sub, 'userId');

    const [manualExpenses, products] = await Promise.all([
      this.expenseModel
        .find({
          businessId,
          expenseDate: { $gte: start, $lt: end },
        })
        .exec(),
      this.productModel.find({ businessId }).exec(),
    ]);

    const payloads: Array<Record<string, any>> = [];

    for (const expense of manualExpenses) {
      const dedupeKey = `expense_manual:${expense.id}`;

      payloads.push({
        businessId,
        direction: FinanceMovementDirection.OUT,
        type: FinanceMovementType.EXPENSE_MANUAL,
        title: expense.title,
        description: expense.description ?? expense.notes ?? null,
        amount: Number(expense.amount ?? 0),
        currency: expense.currency,
        date: expense.expenseDate,
        source: 'expense',
        sourceId: expense.id,
        expenseId: expense.id,
        paymentStatus: expense.paymentStatus ?? null,
        dedupeKey,
        meta: {
          category: expense.category ?? null,
          expenseType: expense.type,
        },
        createdBy: userId,
        updatedBy: userId,
      });
    }

    for (const product of products) {
      const productId = product.id;
      const productName = product.name;
      const ownershipType =
        product.ownership?.ownershipType ?? ProductOwnershipType.OWNED;

      if (
        ownershipType === ProductOwnershipType.OWNED &&
        product.ownership?.purchasePrice != null &&
        product.ownership.purchaseDate &&
        product.ownership.purchaseDate >= start &&
        product.ownership.purchaseDate < end
      ) {
        payloads.push({
          businessId,
          direction: FinanceMovementDirection.OUT,
          type: FinanceMovementType.VEHICLE_PURCHASE,
          title: `Compra de unidad - ${productName}`,
          description: 'Compra de producto/unidad propia',
          amount: Number(product.ownership.purchasePrice ?? 0),
          currency: product.currency,
          date: product.ownership.purchaseDate,
          source: 'product',
          sourceId: productId,
          productId,
          productName,
          dedupeKey: `vehicle_purchase:${productId}`,
          meta: {
            ownershipType,
          },
          createdBy: userId,
          updatedBy: userId,
        });
      }

      const extraItems = product.finance?.extraExpenseItems ?? [];
      extraItems.forEach((item, index) => {
        const itemDate =
          item?.expenseDate ?? product.updatedAt ?? product.createdAt ?? null;

        if (!itemDate) return;
        if (itemDate < start || itemDate >= end) return;

        payloads.push({
          businessId,
          direction: FinanceMovementDirection.OUT,
          type: FinanceMovementType.PRODUCT_EXTRA_EXPENSE,
          title: `${productName} - ${item.label}`,
          description: 'Gasto extra del producto',
          amount: Number(item.amount ?? 0),
          currency: product.currency,
          date: itemDate,
          source: 'product',
          sourceId: productId,
          productId,
          productName,
          dedupeKey: `product_extra_expense:${productId}:${index}:${item.label}:${Number(
            item.amount ?? 0,
          )}:${itemDate.toISOString()}`,
          meta: {
            label: item.label,
          },
          createdBy: userId,
          updatedBy: userId,
        });
      });

      if (
        product.reservation?.depositAmount != null &&
        product.reservation?.depositDate &&
        product.reservation.depositDate >= start &&
        product.reservation.depositDate < end
      ) {
        payloads.push({
          businessId,
          direction: FinanceMovementDirection.IN,
          type: FinanceMovementType.DEPOSIT_RECEIVED,
          title: `Seña recibida - ${productName}`,
          description: product.reservation.notes ?? null,
          amount: Number(product.reservation.depositAmount ?? 0),
          currency: product.reservation.depositCurrency ?? product.currency,
          date: product.reservation.depositDate,
          source: 'product',
          sourceId: productId,
          productId,
          productName,
          dedupeKey: `deposit_received:${productId}:${product.reservation.depositDate.toISOString()}:${Number(
            product.reservation.depositAmount ?? 0,
          )}`,
          meta: {
            customerName: product.reservation.customerName ?? null,
            customerPhone: product.reservation.customerPhone ?? null,
          },
          createdBy: userId,
          updatedBy: userId,
        });
      }

      if (
        product.soldAt &&
        product.soldAt >= start &&
        product.soldAt < end &&
        product.finance?.finalSalePrice != null
      ) {
        payloads.push({
          businessId,
          direction: FinanceMovementDirection.IN,
          type: FinanceMovementType.PRODUCT_SALE,
          title: `Venta - ${productName}`,
          description: 'Venta final del producto',
          amount: Number(product.finance.finalSalePrice ?? 0),
          currency: product.currency,
          date: product.soldAt,
          source: 'product',
          sourceId: productId,
          productId,
          productName,
          dedupeKey: `product_sale:${productId}:${product.soldAt.toISOString()}:${Number(
            product.finance.finalSalePrice ?? 0,
          )}`,
          createdBy: userId,
          updatedBy: userId,
        });

        if (ownershipType === ProductOwnershipType.CONSIGNMENT) {
          const ownerExpectedAmount = Number(
            product.ownership?.ownerExpectedAmount ?? 0,
          );

          if (ownerExpectedAmount > 0) {
            payloads.push({
              businessId,
              direction: FinanceMovementDirection.OUT,
              type: FinanceMovementType.CONSIGNMENT_SETTLEMENT,
              title: `Liquidación consignación - ${productName}`,
              description: 'Monto a entregar al dueño consignante',
              amount: ownerExpectedAmount,
              currency: product.currency,
              date: product.soldAt,
              source: 'product',
              sourceId: productId,
              productId,
              productName,
              dedupeKey: `consignment_settlement:${productId}:${product.soldAt.toISOString()}:${ownerExpectedAmount}`,
              meta: {
                consignorName: product.ownership?.consignorName ?? null,
                consignorPhone: product.ownership?.consignorPhone ?? null,
              },
              createdBy: userId,
              updatedBy: userId,
            });
          }
        }
      }
    }

    for (const payload of payloads) {
      const { createdBy, ...restPayload } = payload;

      await this.financeMovementModel.updateOne(
        { dedupeKey: payload.dedupeKey },
        {
          $set: {
            ...restPayload,
            updatedBy: userId,
          },
          $setOnInsert: {
            createdBy: userId,
          },
        },
        { upsert: true },
      );
    }

    return {
      message: 'Finance movements synced successfully',
      synced: payloads.length,
    };
  }

  async getMovements(currentUser: CurrentUser, month?: string) {
    this.ensureBusinessContext(currentUser);

    const { start, end } = this.getMonthRange(month);
    const businessId = this.toObjectId(currentUser.businessId, 'businessId');

    return this.financeMovementModel
      .find({
        businessId,
        date: { $gte: start, $lt: end },
      })
      .sort({ date: -1, createdAt: -1 })
      .lean()
      .exec();
  }

  async getSummary(
    currentUser: CurrentUser,
    month?: string,
  ): Promise<FinanceSummary> {
    this.ensureBusinessContext(currentUser);

    const { start, end, normalizedMonth } = this.getMonthRange(month);
    const businessId = this.toObjectId(currentUser.businessId, 'businessId');

    const [movements, products] = await Promise.all([
      this.financeMovementModel
        .find({ businessId, date: { $gte: start, $lt: end } })
        .lean()
        .exec(),
      this.productModel.find({ businessId }).exec(),
    ]);

    let income = 0;
    let expenses = 0;
    let salesIncome = 0;
    let depositsIncome = 0;
    let manualExpensesTotal = 0;
    let productExtraExpensesTotal = 0;
    let vehiclePurchasesTotal = 0;
    let consignmentSettlementsTotal = 0;

    for (const movement of movements) {
      const amount = Number(movement.amount ?? 0);

      if (movement.direction === FinanceMovementDirection.IN) income += amount;
      if (movement.direction === FinanceMovementDirection.OUT) expenses += amount;

      switch (movement.type) {
        case FinanceMovementType.PRODUCT_SALE:
          salesIncome += amount;
          break;
        case FinanceMovementType.DEPOSIT_RECEIVED:
          depositsIncome += amount;
          break;
        case FinanceMovementType.EXPENSE_MANUAL:
          manualExpensesTotal += amount;
          break;
        case FinanceMovementType.PRODUCT_EXTRA_EXPENSE:
          productExtraExpensesTotal += amount;
          break;
        case FinanceMovementType.VEHICLE_PURCHASE:
          vehiclePurchasesTotal += amount;
          break;
        case FinanceMovementType.CONSIGNMENT_SETTLEMENT:
          consignmentSettlementsTotal += amount;
          break;
      }
    }

    const publishedCount = products.filter((p) => p.status === 'published').length;
    const reservedCount = products.filter((p) => p.status === 'reserved').length;
    const soldCount = products.filter((p) => p.status === 'sold').length;

    const ownedCount = products.filter(
      (p) =>
        (p.ownership?.ownershipType ?? ProductOwnershipType.OWNED) ===
        ProductOwnershipType.OWNED,
    ).length;

    const consignmentCount = products.filter(
      (p) => p.ownership?.ownershipType === ProductOwnershipType.CONSIGNMENT,
    ).length;

    let estimatedProfit = 0;
    let realProfit = 0;

    for (const product of products) {
      const extraExpensesTotal = (product.finance?.extraExpenseItems ?? []).reduce(
        (acc, item) => acc + Number(item.amount ?? 0),
        0,
      );

      const ownershipType =
        product.ownership?.ownershipType ?? ProductOwnershipType.OWNED;

      const baseCost =
        ownershipType === ProductOwnershipType.CONSIGNMENT
          ? Number(product.ownership?.ownerExpectedAmount ?? 0)
          : Number(product.finance?.costPrice ?? 0);

      const estimatedSale =
        product.finance?.estimatedSalePrice != null
          ? Number(product.finance.estimatedSalePrice)
          : Number(product.salePrice ?? 0);

      estimatedProfit += estimatedSale - baseCost - extraExpensesTotal;

      if (product.finance?.finalSalePrice != null) {
        realProfit +=
          Number(product.finance.finalSalePrice) - baseCost - extraExpensesTotal;
      }
    }

    return {
      period: {
        month: normalizedMonth,
        start,
        end,
      },
      totals: {
        income,
        expenses,
        balance: income - expenses,
        salesIncome,
        depositsIncome,
        manualExpenses: manualExpensesTotal,
        productExtraExpenses: productExtraExpensesTotal,
        vehiclePurchases: vehiclePurchasesTotal,
        consignmentSettlements: consignmentSettlementsTotal,
      },
      productStats: {
        publishedCount,
        reservedCount,
        soldCount,
        ownedCount,
        consignmentCount,
        estimatedProfit,
        realProfit,
      },
    };
  }

  private getMonthRange(month?: string) {
    if (!month) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      return {
        start,
        end,
        normalizedMonth: this.formatMonth(start),
      };
    }

    const match = /^(\d{4})-(\d{2})$/.exec(month);
    if (!match) {
      throw new BadRequestException('month must have YYYY-MM format');
    }

    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;

    if (monthIndex < 0 || monthIndex > 11) {
      throw new BadRequestException('Invalid month');
    }

    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 1);

    return {
      start,
      end,
      normalizedMonth: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
    };
  }

  private formatMonth(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private toObjectId(value: string, fieldName = 'id') {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException(`Invalid ${fieldName}`);
    }

    return new Types.ObjectId(value);
  }

  private ensureBusinessContext(currentUser: CurrentUser) {
    if (!currentUser.businessId) {
      throw new BadRequestException(
        'This action requires a business-scoped user',
      );
    }
  }
}