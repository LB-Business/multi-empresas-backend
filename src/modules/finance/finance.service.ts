import { BadRequestException, Injectable } from '@nestjs/common';
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

type CurrencyCode = 'ARS' | 'USD';

type FinanceTotals = {
  income: number;
  expenses: number;
  balance: number;
  salesIncome: number;
  depositsIncome: number;
  depositRefunds: number;
  manualExpenses: number;
  productExtraExpenses: number;
  vehiclePurchases: number;
  consignmentSettlements: number;
};

type FinanceSummary = {
  period: {
    month: string;
    start: Date;
    end: Date;
  };
  totals: FinanceTotals;
  totalsByCurrency: {
    ARS: FinanceTotals;
    USD: FinanceTotals;
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
  productStatsByCurrency: {
    ARS: {
      estimatedProfit: number;
      realProfit: number;
    };
    USD: {
      estimatedProfit: number;
      realProfit: number;
    };
  };
};

function createEmptyTotals(): FinanceTotals {
  return {
    income: 0,
    expenses: 0,
    balance: 0,
    salesIncome: 0,
    depositsIncome: 0,
    depositRefunds: 0,
    manualExpenses: 0,
    productExtraExpenses: 0,
    vehiclePurchases: 0,
    consignmentSettlements: 0,
  };
}

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

    const [manualExpenses, products, existingDepositMovements, existingRefundMovements] =
      await Promise.all([
        this.expenseModel
          .find({
            businessId,
            expenseDate: { $gte: start, $lt: end },
          })
          .exec(),

        this.productModel.find({ businessId }).exec(),

        this.financeMovementModel
          .find({
            businessId,
            type: FinanceMovementType.DEPOSIT_RECEIVED,
          })
          .lean()
          .exec(),

        this.financeMovementModel
          .find({
            businessId,
            type: FinanceMovementType.DEPOSIT_REFUNDED,
          })
          .select('dedupeKey meta')
          .lean()
          .exec(),
      ]);

    const existingRefundKeys = new Set<string>();

    for (const movement of existingRefundMovements) {
      if (movement.dedupeKey) {
        existingRefundKeys.add(String(movement.dedupeKey));
      }

      const originalDepositDedupeKey = String(
        (movement.meta as any)?.originalDepositDedupeKey ?? '',
      );

      if (originalDepositDedupeKey) {
        existingRefundKeys.add(`deposit_refunded:${originalDepositDedupeKey}`);
      }
    }

    const payloads: Array<Record<string, any>> = [];

    for (const expense of manualExpenses) {
      const currency = this.normalizeCurrency(expense.currency, 'ARS');

      payloads.push({
        businessId,
        direction: FinanceMovementDirection.OUT,
        type: FinanceMovementType.EXPENSE_MANUAL,
        title: expense.title,
        description: expense.description ?? expense.notes ?? null,
        amount: Number(expense.amount ?? 0),
        currency,
        date: expense.expenseDate,
        source: 'expense',
        sourceId: expense.id,
        expenseId: expense.id,
        productId: null,
        productName: null,
        paymentStatus: expense.paymentStatus ?? null,
        dedupeKey: `expense_manual:${expense.id}`,
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
      const productCurrency = this.normalizeCurrency(product.currency, 'ARS');

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
          currency: productCurrency,
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
          currency: 'ARS',
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

      const currentDepositAmount = Number(
        product.reservation?.depositAmount ?? 0,
      );

      if (currentDepositAmount > 0) {
        const depositDate =
          product.reservation?.depositDate ??
          product.updatedAt ??
          product.createdAt ??
          new Date();

        if (depositDate >= start && depositDate < end) {
          const depositCurrency = this.normalizeCurrency(
            product.reservation?.depositCurrency,
            productCurrency,
          );

          const hasExistingActiveDeposit = existingDepositMovements.some(
            (movement) => {
              const movementProductId = this.getMovementProductId(movement);
              const movementAmount = Number(movement.amount ?? 0);
              const movementCurrency = this.normalizeCurrency(
                movement.currency,
                depositCurrency,
              );

              const isRefunded = this.isDepositMovementRefunded(
                movement.dedupeKey,
                existingRefundKeys,
              );

              return (
                movementProductId === productId &&
                movementAmount === currentDepositAmount &&
                movementCurrency === depositCurrency &&
                !isRefunded
              );
            },
          );

          if (!hasExistingActiveDeposit) {
            const baseDepositDedupeKey = `deposit_received:${productId}:${depositDate.toISOString()}:${currentDepositAmount}`;

            const baseDepositWasAlreadyRefunded =
              existingRefundKeys.has(`deposit_refunded:${baseDepositDedupeKey}`);

            const dedupeKey = baseDepositWasAlreadyRefunded
              ? `deposit_received:${productId}:${depositDate.toISOString()}:${currentDepositAmount}:cycle:${this.getDedupeDateKey(
                  product.updatedAt ?? new Date(),
                )}`
              : baseDepositDedupeKey;

            payloads.push({
              businessId,
              direction: FinanceMovementDirection.IN,
              type: FinanceMovementType.DEPOSIT_RECEIVED,
              title: `Seña recibida - ${productName}`,
              description: product.reservation?.notes ?? null,
              amount: currentDepositAmount,
              currency: depositCurrency,
              date: depositDate,
              source: 'product',
              sourceId: productId,
              productId,
              productName,
              dedupeKey,
              meta: {
                customerName: product.reservation?.customerName ?? null,
                customerPhone: product.reservation?.customerPhone ?? null,
                depositDate,
                cycleCreatedAt: product.updatedAt ?? new Date(),
              },
              createdBy: userId,
              updatedBy: userId,
            });
          }
        }
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
          currency: productCurrency,
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
              currency: productCurrency,
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

    const productsById = new Map<string, ProductDocument>();

    for (const product of products) {
      productsById.set(product.id, product);
    }

    for (const depositMovement of existingDepositMovements) {
      const depositDedupeKey = String(depositMovement.dedupeKey ?? '');

      if (
        !depositDedupeKey ||
        this.isDepositMovementRefunded(depositDedupeKey, existingRefundKeys)
      ) {
        continue;
      }

      const productId = this.getMovementProductId(depositMovement);

      if (!productId) continue;

      const product = productsById.get(productId);

      if (!product) continue;

      const hasActiveDeposit =
        product.reservation?.depositAmount != null &&
        Number(product.reservation.depositAmount ?? 0) > 0;

      if (hasActiveDeposit) continue;

      if (product.status !== 'published') continue;

      const refundDedupeKey = `deposit_refunded:${depositDedupeKey}`;

      if (existingRefundKeys.has(refundDedupeKey)) continue;

      const refundDate = product.updatedAt ?? new Date();

      if (refundDate < start || refundDate >= end) continue;

      payloads.push({
        businessId,
        direction: FinanceMovementDirection.OUT,
        type: FinanceMovementType.DEPOSIT_REFUNDED,
        title: `Seña devuelta - ${depositMovement.productName ?? product.name}`,
        description: 'Devolución de seña',
        amount: Number(depositMovement.amount ?? 0),
        currency: this.normalizeCurrency(depositMovement.currency, 'ARS'),
        date: refundDate,
        source: 'product',
        sourceId: productId,
        productId,
        productName: depositMovement.productName ?? product.name,
        dedupeKey: refundDedupeKey,
        meta: {
          originalDepositMovementId: String((depositMovement as any)._id),
          originalDepositDedupeKey: depositDedupeKey,
          reason: 'deposit_returned_and_product_republished',
        },
        createdBy: userId,
        updatedBy: userId,
      });
    }

    for (const payload of payloads) {
      const { createdBy, ...restPayload } = payload;

      await this.financeMovementModel.updateOne(
        {
          businessId,
          dedupeKey: payload.dedupeKey,
        },
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

    await this.syncMovements(currentUser, month);

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

    await this.syncMovements(currentUser, month);

    const [movements, products] = await Promise.all([
      this.financeMovementModel
        .find({
          businessId,
          date: { $gte: start, $lt: end },
        })
        .lean()
        .exec(),

      this.productModel.find({ businessId }).exec(),
    ]);

    const totalsByCurrency = {
      ARS: createEmptyTotals(),
      USD: createEmptyTotals(),
    };

    for (const movement of movements) {
      const amount = Number(movement.amount ?? 0);
      const currency = this.normalizeCurrency(movement.currency, 'ARS');
      const totals = totalsByCurrency[currency];

      if (movement.direction === FinanceMovementDirection.IN) {
        totals.income += amount;
      }

      if (movement.direction === FinanceMovementDirection.OUT) {
        totals.expenses += amount;
      }

      switch (movement.type) {
        case FinanceMovementType.PRODUCT_SALE:
          totals.salesIncome += amount;
          break;

        case FinanceMovementType.DEPOSIT_RECEIVED:
          totals.depositsIncome += amount;
          break;

        case FinanceMovementType.DEPOSIT_REFUNDED:
          totals.depositRefunds += amount;
          break;

        case FinanceMovementType.EXPENSE_MANUAL:
          totals.manualExpenses += amount;
          break;

        case FinanceMovementType.PRODUCT_EXTRA_EXPENSE:
          totals.productExtraExpenses += amount;
          break;

        case FinanceMovementType.VEHICLE_PURCHASE:
          totals.vehiclePurchases += amount;
          break;

        case FinanceMovementType.CONSIGNMENT_SETTLEMENT:
          totals.consignmentSettlements += amount;
          break;
      }
    }

    totalsByCurrency.ARS.balance =
      totalsByCurrency.ARS.income - totalsByCurrency.ARS.expenses;

    totalsByCurrency.USD.balance =
      totalsByCurrency.USD.income - totalsByCurrency.USD.expenses;

    const publishedCount = products.filter(
      (p) => p.status === 'published',
    ).length;

    const reservedCount = products.filter(
      (p) => p.status === 'reserved',
    ).length;

    const soldCount = products.filter((p) => p.status === 'sold').length;

    const ownedCount = products.filter(
      (p) =>
        (p.ownership?.ownershipType ?? ProductOwnershipType.OWNED) ===
        ProductOwnershipType.OWNED,
    ).length;

    const consignmentCount = products.filter(
      (p) => p.ownership?.ownershipType === ProductOwnershipType.CONSIGNMENT,
    ).length;

    const productStatsByCurrency = {
      ARS: {
        estimatedProfit: 0,
        realProfit: 0,
      },
      USD: {
        estimatedProfit: 0,
        realProfit: 0,
      },
    };

    for (const product of products) {
      const productCurrency = this.normalizeCurrency(product.currency, 'ARS');

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

      const finalSale =
        product.finance?.finalSalePrice != null
          ? Number(product.finance.finalSalePrice)
          : null;

      const extraExpensesTotal = (
        product.finance?.extraExpenseItems ?? []
      ).reduce((acc, item) => acc + Number(item.amount ?? 0), 0);

      if (productCurrency === 'USD') {
        productStatsByCurrency.USD.estimatedProfit += estimatedSale - baseCost;

        if (
          finalSale != null &&
          product.soldAt &&
          product.soldAt >= start &&
          product.soldAt < end
        ) {
          productStatsByCurrency.USD.realProfit += finalSale - baseCost;
        }

        productStatsByCurrency.ARS.estimatedProfit -= extraExpensesTotal;

        if (
          finalSale != null &&
          product.soldAt &&
          product.soldAt >= start &&
          product.soldAt < end
        ) {
          productStatsByCurrency.ARS.realProfit -= extraExpensesTotal;
        }
      } else {
        productStatsByCurrency.ARS.estimatedProfit +=
          estimatedSale - baseCost - extraExpensesTotal;

        if (
          finalSale != null &&
          product.soldAt &&
          product.soldAt >= start &&
          product.soldAt < end
        ) {
          productStatsByCurrency.ARS.realProfit +=
            finalSale - baseCost - extraExpensesTotal;
        }
      }
    }

    return {
      period: {
        month: normalizedMonth,
        start,
        end,
      },

      totals: totalsByCurrency.ARS,
      totalsByCurrency,

      productStats: {
        publishedCount,
        reservedCount,
        soldCount,
        ownedCount,
        consignmentCount,
        estimatedProfit: productStatsByCurrency.ARS.estimatedProfit,
        realProfit: productStatsByCurrency.ARS.realProfit,
      },

      productStatsByCurrency,
    };
  }

  private normalizeCurrency(
    value?: string | null,
    fallback: CurrencyCode = 'ARS',
  ): CurrencyCode {
    const normalized = String(value ?? '')
      .trim()
      .toUpperCase();

    if (normalized === 'USD') return 'USD';
    if (normalized === 'ARS') return 'ARS';

    return fallback;
  }

  private getMovementProductId(movement: any) {
    return String(
      movement?.productId ||
        movement?.sourceId ||
        movement?.meta?.productId ||
        '',
    );
  }

  private isDepositMovementRefunded(
    depositDedupeKey: string | null | undefined,
    existingRefundKeys: Set<string>,
  ) {
    if (!depositDedupeKey) return false;

    return existingRefundKeys.has(`deposit_refunded:${depositDedupeKey}`);
  }

  private getDedupeDateKey(date: Date) {
    return new Date(date).toISOString().replace(/[^0-9]/g, '');
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