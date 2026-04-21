import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Currency } from '../../common/enums/currency.enum';
import { ExpensePaymentStatus } from '../../common/enums/expense-payment-status.enum';
import { ExpenseType } from '../../common/enums/expense-type.enum';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { MovementsService } from '../movements/movements.service';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { FindExpensesDto } from './dto/find-expenses.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import {
  Expense,
  ExpenseDocument,
  ExpenseRecurrence,
} from './schemas/expense.schema';

type UnifiedExpenseItem = {
  id: string;
  _id: string;
  businessId: string;
  title: string;
  category?: string | null;
  description?: string | null;
  type: ExpenseType;
  amount: number;
  currency: Currency;
  expenseDate: Date;
  dueDate?: Date | null;
  isRecurring?: boolean;
  recurrence?: ExpenseRecurrence | null;
  recurrenceEndDate?: Date | null;
  calendarEnabled?: boolean;
  paymentStatus: ExpensePaymentStatus;
  notes?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  source: 'expense' | 'product_extra';
  sourceExpenseId?: string;
  sourceProductId?: string;
  productName?: string | null;
  expenseLabel?: string | null;
  readOnly?: boolean;
};

@Injectable()
export class ExpensesService {
  constructor(
    @InjectModel(Expense.name)
    private readonly expenseModel: Model<ExpenseDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly movementsService: MovementsService,
  ) {}

  async create(dto: CreateExpenseDto, currentUser: CurrentUser) {
    this.ensureBusinessContext(currentUser);
    this.validateRecurringConfig(dto);

    const expense = await this.expenseModel.create({
      businessId: this.toObjectId(currentUser.businessId, 'businessId'),
      title: dto.title,
      category: dto.category ?? null,
      description: dto.description ?? null,
      type: dto.type,
      amount: dto.amount,
      currency: dto.currency,
      expenseDate: this.parseDate(dto.expenseDate, 'expenseDate'),
      dueDate: dto.dueDate ? this.parseDate(dto.dueDate, 'dueDate') : null,
      isRecurring: dto.isRecurring ?? false,
      recurrence:
        dto.isRecurring === true ? (dto.recurrence ?? null) : null,
      recurrenceEndDate: dto.recurrenceEndDate
        ? this.parseDate(dto.recurrenceEndDate, 'recurrenceEndDate')
        : null,
      calendarEnabled: dto.calendarEnabled ?? false,
      paymentStatus: dto.paymentStatus ?? ExpensePaymentStatus.PAID,
      notes: dto.notes ?? null,
      createdBy: this.toObjectId(currentUser.sub, 'userId'),
      updatedBy: this.toObjectId(currentUser.sub, 'userId'),
    });

    await this.movementsService.createMovement(
      {
        type: 'expense_created',
        title: `Gasto creado: ${expense.title}`,
        description: expense.description ?? null,
        meta: {
          expenseId: expense.id,
          category: expense.category ?? null,
          type: expense.type,
          paymentStatus: expense.paymentStatus,
          dueDate: expense.dueDate ?? null,
          isRecurring: expense.isRecurring ?? false,
          recurrence: expense.recurrence ?? null,
          calendarEnabled: expense.calendarEnabled ?? false,
        },
        amount: expense.amount,
        direction:
          expense.paymentStatus === ExpensePaymentStatus.PAID ? 'out' : 'neutral',
        date: expense.expenseDate ?? new Date(),
      },
      currentUser,
    );

    return expense;
  }

  async findAll(currentUser: CurrentUser, query: FindExpensesDto) {
    this.ensureBusinessContext(currentUser);
    return this.getCombinedExpenses(currentUser, query);
  }

  async findOne(id: string, currentUser: CurrentUser) {
    this.ensureBusinessContext(currentUser);

    const expense = await this.expenseModel.findOne({
      _id: this.toObjectId(id, 'expenseId'),
      businessId: this.toObjectId(currentUser.businessId, 'businessId'),
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    return expense;
  }

  async update(id: string, dto: UpdateExpenseDto, currentUser: CurrentUser) {
    this.ensureBusinessContext(currentUser);

    const expense = await this.expenseModel.findOne({
      _id: this.toObjectId(id, 'expenseId'),
      businessId: this.toObjectId(currentUser.businessId, 'businessId'),
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    const previousPaymentStatus = expense.paymentStatus;
    const previousAmount = expense.amount;
    const previousExpenseDate = expense.expenseDate;
    const previousTitle = expense.title;

    const nextRecurring =
      dto.isRecurring !== undefined ? dto.isRecurring : expense.isRecurring;

    const nextRecurrence =
      dto.recurrence !== undefined ? dto.recurrence : expense.recurrence;

    this.validateRecurringConfig({
      ...dto,
      isRecurring: nextRecurring,
      recurrence: nextRecurrence ?? undefined,
    });

    if (dto.title !== undefined) expense.title = dto.title;
    if (dto.category !== undefined) expense.category = dto.category ?? null;
    if (dto.description !== undefined) expense.description = dto.description ?? null;
    if (dto.type !== undefined) expense.type = dto.type;
    if (dto.amount !== undefined) expense.amount = dto.amount;
    if (dto.currency !== undefined) expense.currency = dto.currency;

    if (dto.expenseDate !== undefined) {
      expense.expenseDate = this.parseDate(dto.expenseDate, 'expenseDate');
    }

    if (dto.dueDate !== undefined) {
      expense.dueDate = dto.dueDate
        ? this.parseDate(dto.dueDate, 'dueDate')
        : null;
    }

    if (dto.isRecurring !== undefined) {
      expense.isRecurring = dto.isRecurring;
    }

    if (dto.recurrence !== undefined) {
      expense.recurrence = dto.isRecurring === false ? null : dto.recurrence ?? null;
    } else if (dto.isRecurring === false) {
      expense.recurrence = null;
    }

    if (dto.recurrenceEndDate !== undefined) {
      expense.recurrenceEndDate = dto.recurrenceEndDate
        ? this.parseDate(dto.recurrenceEndDate, 'recurrenceEndDate')
        : null;
    }

    if (dto.calendarEnabled !== undefined) {
      expense.calendarEnabled = dto.calendarEnabled;
    }

    if (dto.paymentStatus !== undefined) {
      expense.paymentStatus = dto.paymentStatus;
    }

    if (dto.notes !== undefined) {
      expense.notes = dto.notes ?? null;
    }

    expense.updatedBy = this.toObjectId(currentUser.sub, 'userId');

    await expense.save();

    const paymentStatusChanged =
      previousPaymentStatus !== expense.paymentStatus;

    if (paymentStatusChanged) {
      await this.movementsService.createMovement(
        {
          type:
            expense.paymentStatus === ExpensePaymentStatus.PAID
              ? 'expense_paid'
              : 'expense_pending',
          title:
            expense.paymentStatus === ExpensePaymentStatus.PAID
              ? `Gasto marcado como pagado: ${expense.title}`
              : `Gasto marcado como pendiente: ${expense.title}`,
          description: expense.description ?? null,
          meta: {
            expenseId: expense.id,
            previousPaymentStatus,
            nextPaymentStatus: expense.paymentStatus,
            category: expense.category ?? null,
            type: expense.type,
          },
          amount: expense.amount,
          direction:
            expense.paymentStatus === ExpensePaymentStatus.PAID
              ? 'out'
              : 'neutral',
          date: expense.expenseDate ?? new Date(),
        },
        currentUser,
      );
    } else {
      await this.movementsService.createMovement(
        {
          type: 'expense_updated',
          title: `Gasto actualizado: ${previousTitle}`,
          description: expense.description ?? null,
          meta: {
            expenseId: expense.id,
            previousAmount,
            nextAmount: expense.amount,
            previousExpenseDate,
            nextExpenseDate: expense.expenseDate,
            category: expense.category ?? null,
            type: expense.type,
            paymentStatus: expense.paymentStatus,
            dueDate: expense.dueDate ?? null,
            isRecurring: expense.isRecurring ?? false,
            recurrence: expense.recurrence ?? null,
            calendarEnabled: expense.calendarEnabled ?? false,
          },
          amount: expense.amount,
          direction:
            expense.paymentStatus === ExpensePaymentStatus.PAID
              ? 'out'
              : 'neutral',
          date: expense.expenseDate ?? new Date(),
        },
        currentUser,
      );
    }

    return expense;
  }

  async remove(id: string, currentUser: CurrentUser) {
    this.ensureBusinessContext(currentUser);

    const expense = await this.expenseModel.findOne({
      _id: this.toObjectId(id, 'expenseId'),
      businessId: this.toObjectId(currentUser.businessId, 'businessId'),
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    await this.expenseModel.deleteOne({ _id: expense._id }).exec();

    await this.movementsService.createMovement(
      {
        type: 'expense_deleted',
        title: `Gasto eliminado: ${expense.title}`,
        description: expense.description ?? null,
        meta: {
          expenseId: expense.id,
          category: expense.category ?? null,
          type: expense.type,
          paymentStatus: expense.paymentStatus,
          dueDate: expense.dueDate ?? null,
          isRecurring: expense.isRecurring ?? false,
          recurrence: expense.recurrence ?? null,
          calendarEnabled: expense.calendarEnabled ?? false,
        },
        amount: expense.amount,
        direction: 'neutral',
        date: new Date(),
      },
      currentUser,
    );

    return { message: 'Expense deleted successfully' };
  }

  async getMonthlySummary(currentUser: CurrentUser, query: FindExpensesDto) {
    this.ensureBusinessContext(currentUser);

    const month = query.month ?? this.formatMonth(new Date());
    const { start, end } = this.getMonthRange(month);

    const combined = await this.getCombinedExpenses(currentUser, {
      ...query,
      month,
    });

    const summary = combined.reduce(
      (acc, item) => {
        acc.totalAmount += item.amount;
        acc.count += 1;

        if (item.type === ExpenseType.FIXED) {
          acc.fixedAmount += item.amount;
        }

        if (item.type === ExpenseType.EXTRA) {
          acc.extraAmount += item.amount;
        }

        if (item.paymentStatus === ExpensePaymentStatus.PAID) {
          acc.paidAmount += item.amount;
        }

        if (item.paymentStatus === ExpensePaymentStatus.PENDING) {
          acc.pendingAmount += item.amount;
        }

        return acc;
      },
      {
        totalAmount: 0,
        count: 0,
        fixedAmount: 0,
        extraAmount: 0,
        paidAmount: 0,
        pendingAmount: 0,
      },
    );

    return {
      month,
      range: {
        start,
        end,
      },
      ...summary,
    };
  }

  private async getCombinedExpenses(
    currentUser: CurrentUser,
    query: FindExpensesDto,
  ): Promise<UnifiedExpenseItem[]> {
    const filters = this.buildFilters(currentUser.businessId, query);

    const [manualExpenses, productExtraExpenses] = await Promise.all([
      this.expenseModel.find(filters).sort({ expenseDate: -1, createdAt: -1 }).exec(),
      this.getProductExtraExpenses(currentUser.businessId, query),
    ]);

    const serializedManual = manualExpenses.map((expense) =>
      this.serializeExpense(expense),
    );

    return [...serializedManual, ...productExtraExpenses].sort((a, b) => {
      const dateDiff =
        new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime();

      if (dateDiff !== 0) return dateDiff;

      const createdAtA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const createdAtB = b.createdAt ? new Date(b.createdAt).getTime() : 0;

      return createdAtB - createdAtA;
    });
  }

  private async getProductExtraExpenses(
    businessId: string,
    query: FindExpensesDto,
  ): Promise<UnifiedExpenseItem[]> {
    if (query.type && query.type !== ExpenseType.EXTRA) {
      return [];
    }

    if (
      query.paymentStatus &&
      query.paymentStatus !== ExpensePaymentStatus.PAID
    ) {
      return [];
    }

    const businessObjectId = this.toObjectId(businessId, 'businessId');
    const monthRange = query.month ? this.getMonthRange(query.month) : null;

    const products = await this.productModel
      .find({
        businessId: businessObjectId,
        'finance.extraExpenseItems.0': { $exists: true },
      })
      .sort({ updatedAt: -1, createdAt: -1 })
      .exec();

    const derived: UnifiedExpenseItem[] = [];

    for (const product of products) {
      const items = product.finance?.extraExpenseItems ?? [];

      items.forEach((item, index) => {
        const amount = Number(item?.amount ?? 0);
        const label = item?.label?.trim?.() ?? '';

        if (!label || amount < 0) {
          return;
        }

        const expenseDate =
          item?.expenseDate ??
          product.updatedAt ??
          product.createdAt ??
          new Date();

        if (
          monthRange &&
          !(expenseDate >= monthRange.start && expenseDate < monthRange.end)
        ) {
          return;
        }

        const id = `product-extra-${product.id}-${index}`;

        derived.push({
          id,
          _id: id,
          businessId: product.businessId.toString(),
          title: `${product.name} - ${label}`,
          category: product.category ?? 'Producto',
          description: `Gasto extra cargado desde el producto ${product.name}`,
          type: ExpenseType.EXTRA,
          amount,
          currency: product.currency ?? Currency.ARS,
          expenseDate,
          dueDate: null,
          isRecurring: false,
          recurrence: null,
          recurrenceEndDate: null,
          calendarEnabled: false,
          paymentStatus: ExpensePaymentStatus.PAID,
          notes: product.finance?.internalNotes ?? null,
          createdAt: product.createdAt ?? expenseDate,
          updatedAt: product.updatedAt ?? expenseDate,
          source: 'product_extra',
          sourceProductId: product.id,
          productName: product.name,
          expenseLabel: label,
          readOnly: true,
        });
      });
    }

    return derived;
  }

  private serializeExpense(expense: ExpenseDocument): UnifiedExpenseItem {
    return {
      id: expense.id,
      _id: expense.id,
      businessId: expense.businessId.toString(),
      title: expense.title,
      category: expense.category ?? null,
      description: expense.description ?? null,
      type: expense.type,
      amount: expense.amount,
      currency: expense.currency,
      expenseDate: expense.expenseDate,
      dueDate: expense.dueDate ?? null,
      isRecurring: expense.isRecurring ?? false,
      recurrence: expense.recurrence ?? null,
      recurrenceEndDate: expense.recurrenceEndDate ?? null,
      calendarEnabled: expense.calendarEnabled ?? false,
      paymentStatus: expense.paymentStatus,
      notes: expense.notes ?? null,
      createdAt: expense.createdAt ?? null,
      updatedAt: expense.updatedAt ?? null,
      source: 'expense',
      sourceExpenseId: expense.id,
      readOnly: false,
    };
  }

  private buildFilters(
    businessId: string,
    query: FindExpensesDto,
  ): FilterQuery<ExpenseDocument> {
    const filters: FilterQuery<ExpenseDocument> = {
      businessId: this.toObjectId(businessId, 'businessId'),
    };

    if (query.type) {
      filters.type = query.type;
    }

    if (query.paymentStatus) {
      filters.paymentStatus = query.paymentStatus;
    }

    if (query.calendarEnabled !== undefined) {
      filters.calendarEnabled = query.calendarEnabled;
    }

    if (query.month) {
      const { start, end } = this.getMonthRange(query.month);
      filters.expenseDate = { $gte: start, $lt: end };
    }

    return filters;
  }

  private validateRecurringConfig(dto: {
    isRecurring?: boolean;
    recurrence?: ExpenseRecurrence;
  }) {
    if (dto.isRecurring && !dto.recurrence) {
      throw new BadRequestException(
        'recurrence is required when isRecurring is true',
      );
    }
  }

  private getMonthRange(month?: string) {
    if (!month) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return { start, end };
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

    return { start, end };
  }

  private formatMonth(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  private parseDate(value: string, fieldName: string) {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid ${fieldName}`);
    }

    return parsed;
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