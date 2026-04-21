import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { CalendarEventStatus } from 'src/common/enums/calendar-event-status.enum';
import { CalendarEventType } from 'src/common/enums/calendar-event-type.enum';
import { Currency } from 'src/common/enums/currency.enum';
import { ExpensePaymentStatus } from 'src/common/enums/expense-payment-status.enum';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { BusinessesService } from '../businesses/businesses.service';
import {
  Expense,
  ExpenseDocument,
  ExpenseRecurrence,
} from '../expenses/schemas/expense.schema';
import {
  Product,
  ProductDocument,
  ProductOwnershipType,
} from '../products/schemas/product.schema';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { CreatePublicBookingDto } from './dto/create-public-booking.dto';
import { FindCalendarEventsDto } from './dto/find-calendar-events.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { UpdateCalendarSettingsDto } from './dto/update-calendar-settings.dto';
import {
  CalendarEvent,
  CalendarEventDocument,
} from './schemas/calendar-event.schema';
import {
  CalendarSettings,
  CalendarSettingsDocument,
} from './schemas/calendar-settings.schema';

type UnifiedCalendarEvent = {
  id: string;
  _id: string;
  businessId: string;
  title: string;
  description?: string | null;
  type:
    | 'reminder'
    | 'appointment'
    | 'meeting'
    | 'task'
    | 'deadline';
  status: 'pending' | 'completed' | 'canceled';
  startAt: Date;
  endAt?: Date | null;
  allDay: boolean;
  reminderMinutesBefore?: number | null;
  assignedUserId?: string | null;
  source:
    | 'calendar'
    | 'public_booking'
    | 'expense_calendar'
    | 'product_calendar';
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  location?: string | null;
  notes?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  meta?: Record<string, unknown>;
  readOnly?: boolean;
};

type DaySummaryItemType =
  | 'calendar_event'
  | 'manual_expense'
  | 'product_extra_expense'
  | 'vehicle_purchase'
  | 'deposit_received'
  | 'product_sale'
  | 'consignment_settlement'
  | 'product_created'
  | 'product_published';

type DaySummaryItem = {
  id: string;
  type: DaySummaryItemType;
  title: string;
  description?: string | null;
  date: Date;
  direction?: 'in' | 'out' | 'neutral';
  amount?: number | null;
  currency?: Currency | null;
  source: 'calendar' | 'expense' | 'product';
  sourceId: string;
  meta?: Record<string, unknown>;
};

@Injectable()
export class CalendarService {
  constructor(
    @InjectModel(CalendarEvent.name)
    private readonly calendarEventModel: Model<CalendarEventDocument>,
    @InjectModel(CalendarSettings.name)
    private readonly calendarSettingsModel: Model<CalendarSettingsDocument>,
    @InjectModel(Expense.name)
    private readonly expenseModel: Model<ExpenseDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly businessesService: BusinessesService,
  ) {}

  async create(dto: CreateCalendarEventDto, currentUser: CurrentUser) {
    this.ensureBusinessContext(currentUser);

    const startAt = this.parseDate(dto.startAt, 'startAt');
    const endAt =
      dto.endAt !== undefined ? this.parseDate(dto.endAt, 'endAt') : null;

    if (endAt && endAt < startAt) {
      throw new BadRequestException('endAt cannot be earlier than startAt');
    }

    return this.calendarEventModel.create({
      businessId: this.toObjectId(currentUser.businessId, 'businessId'),
      title: dto.title,
      description: dto.description ?? null,
      type: dto.type,
      status: dto.status ?? CalendarEventStatus.PENDING,
      startAt,
      endAt,
      allDay: dto.allDay ?? false,
      reminderMinutesBefore: dto.reminderMinutesBefore ?? null,
      assignedUserId: dto.assignedUserId
        ? this.toObjectId(dto.assignedUserId, 'assignedUserId')
        : null,
      source: 'internal',
      contactName: dto.contactName ?? null,
      contactPhone: dto.contactPhone ?? null,
      location: dto.location ?? null,
      notes: dto.notes ?? null,
      createdBy: this.toObjectId(currentUser.sub, 'userId'),
      updatedBy: this.toObjectId(currentUser.sub, 'userId'),
    });
  }

  async findAll(currentUser: CurrentUser, query: FindCalendarEventsDto) {
    this.ensureBusinessContext(currentUser);

    const businessId = this.toObjectId(currentUser.businessId, 'businessId');
    const filters = this.buildFilters(currentUser.businessId, query);

    const dateFrom = query.dateFrom
      ? this.parseDate(query.dateFrom, 'dateFrom')
      : null;
    const dateTo = query.dateTo ? this.parseDate(query.dateTo, 'dateTo') : null;

    const [manualEvents, expenses, products] = await Promise.all([
      this.calendarEventModel
        .find(filters)
        .sort({ startAt: 1, createdAt: -1 })
        .exec(),
      this.expenseModel
        .find({
          businessId,
          ...(query.calendarEnabled !== undefined
            ? { calendarEnabled: query.calendarEnabled }
            : {}),
        })
        .sort({ dueDate: 1, expenseDate: 1, createdAt: -1 })
        .exec(),
      this.productModel
        .find({ businessId })
        .sort({ createdAt: -1, updatedAt: -1 })
        .exec(),
    ]);

    const unified: UnifiedCalendarEvent[] = [
      ...manualEvents.map((event) => this.serializeCalendarEvent(event)),
      ...this.buildExpenseCalendarEvents(expenses, { dateFrom, dateTo }),
      ...this.buildProductCalendarEvents(products, { dateFrom, dateTo }),
    ];

    const filtered = unified.filter((event) => {
      if (query.type && event.type !== query.type) return false;
      if (query.status && event.status !== query.status) return false;

      if (dateFrom && event.startAt < dateFrom) return false;
      if (dateTo && event.startAt > dateTo) return false;

      return true;
    });

    return filtered.sort((a, b) => {
      const startDiff = new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
      if (startDiff !== 0) return startDiff;

      const createdAtA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const createdAtB = b.createdAt ? new Date(b.createdAt).getTime() : 0;

      return createdAtB - createdAtA;
    });
  }

  async findUpcoming(currentUser: CurrentUser) {
    this.ensureBusinessContext(currentUser);

    const now = new Date();

    const items = await this.findAll(currentUser, {
      dateFrom: now.toISOString(),
    });

    return items
      .filter((item) => new Date(item.startAt) >= now)
      .sort(
        (a, b) =>
          new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      )
      .slice(0, 20);
  }

  async findOne(id: string, currentUser: CurrentUser) {
    this.ensureBusinessContext(currentUser);

    const event = await this.calendarEventModel.findOne({
      _id: this.toObjectId(id, 'eventId'),
      businessId: this.toObjectId(currentUser.businessId, 'businessId'),
    });

    if (!event) {
      throw new NotFoundException('Calendar event not found');
    }

    return event;
  }

  async update(
    id: string,
    dto: UpdateCalendarEventDto,
    currentUser: CurrentUser,
  ) {
    this.ensureBusinessContext(currentUser);

    const event = await this.calendarEventModel.findOne({
      _id: this.toObjectId(id, 'eventId'),
      businessId: this.toObjectId(currentUser.businessId, 'businessId'),
    });

    if (!event) {
      throw new NotFoundException('Calendar event not found');
    }

    const nextStartAt =
      dto.startAt !== undefined
        ? this.parseDate(dto.startAt, 'startAt')
        : event.startAt;

    const nextEndAt =
      dto.endAt !== undefined
        ? this.parseDate(dto.endAt, 'endAt')
        : event.endAt ?? null;

    if (nextEndAt && nextEndAt < nextStartAt) {
      throw new BadRequestException('endAt cannot be earlier than startAt');
    }

    if (dto.title !== undefined) event.title = dto.title;
    if (dto.description !== undefined) event.description = dto.description ?? null;
    if (dto.type !== undefined) event.type = dto.type;
    if (dto.status !== undefined) event.status = dto.status;
    if (dto.startAt !== undefined) event.startAt = nextStartAt;
    if (dto.endAt !== undefined) event.endAt = nextEndAt;
    if (dto.allDay !== undefined) event.allDay = dto.allDay;
    if (dto.reminderMinutesBefore !== undefined) {
      event.reminderMinutesBefore = dto.reminderMinutesBefore ?? null;
    }
    if (dto.assignedUserId !== undefined) {
      event.assignedUserId = dto.assignedUserId
        ? this.toObjectId(dto.assignedUserId, 'assignedUserId')
        : null;
    }
    if (dto.contactName !== undefined) event.contactName = dto.contactName ?? null;
    if (dto.contactPhone !== undefined) event.contactPhone = dto.contactPhone ?? null;
    if (dto.location !== undefined) event.location = dto.location ?? null;
    if (dto.notes !== undefined) event.notes = dto.notes ?? null;

    event.updatedBy = this.toObjectId(currentUser.sub, 'userId');

    await event.save();
    return event;
  }

  async remove(id: string, currentUser: CurrentUser) {
    this.ensureBusinessContext(currentUser);

    const event = await this.calendarEventModel.findOneAndDelete({
      _id: this.toObjectId(id, 'eventId'),
      businessId: this.toObjectId(currentUser.businessId, 'businessId'),
    });

    if (!event) {
      throw new NotFoundException('Calendar event not found');
    }

    return { message: 'Calendar event deleted successfully' };
  }

  async getSettings(currentUser: CurrentUser) {
    this.ensureBusinessContext(currentUser);

    const businessId = this.toObjectId(currentUser.businessId, 'businessId');

    let settings = await this.calendarSettingsModel.findOne({ businessId }).exec();

    if (!settings) {
      const business = await this.businessesService.findById(
        currentUser.businessId,
      );

      settings = await this.calendarSettingsModel.create({
        businessId,
        publicBookingEnabled: false,
        timezone: business.timezone ?? 'America/Argentina/Buenos_Aires',
        slotDurationMinutes: 30,
        minAdvanceMinutes: 0,
        maxAdvanceDays: 30,
        weeklyAvailability: this.buildDefaultWeeklyAvailability(),
        dateOverrides: [],
      });
    }

    return settings;
  }

  async updateSettings(
    dto: UpdateCalendarSettingsDto,
    currentUser: CurrentUser,
  ) {
    this.ensureBusinessContext(currentUser);

    const businessId = this.toObjectId(currentUser.businessId, 'businessId');

    let settings = await this.calendarSettingsModel.findOne({ businessId }).exec();

    if (!settings) {
      const business = await this.businessesService.findById(
        currentUser.businessId,
      );

      settings = await this.calendarSettingsModel.create({
        businessId,
        publicBookingEnabled: false,
        timezone: business.timezone ?? 'America/Argentina/Buenos_Aires',
        slotDurationMinutes: 30,
        minAdvanceMinutes: 0,
        maxAdvanceDays: 30,
        weeklyAvailability: this.buildDefaultWeeklyAvailability(),
        dateOverrides: [],
      });
    }

    if (dto.publicBookingEnabled !== undefined) {
      settings.publicBookingEnabled = dto.publicBookingEnabled;
    }

    if (dto.timezone !== undefined) {
      settings.timezone = dto.timezone;
    }

    if (dto.slotDurationMinutes !== undefined) {
      settings.slotDurationMinutes = dto.slotDurationMinutes;
    }

    if (dto.minAdvanceMinutes !== undefined) {
      settings.minAdvanceMinutes = dto.minAdvanceMinutes;
    }

    if (dto.maxAdvanceDays !== undefined) {
      settings.maxAdvanceDays = dto.maxAdvanceDays;
    }

    if (dto.weeklyAvailability !== undefined) {
      settings.weeklyAvailability = {
        monday: dto.weeklyAvailability.monday ?? [],
        tuesday: dto.weeklyAvailability.tuesday ?? [],
        wednesday: dto.weeklyAvailability.wednesday ?? [],
        thursday: dto.weeklyAvailability.thursday ?? [],
        friday: dto.weeklyAvailability.friday ?? [],
        saturday: dto.weeklyAvailability.saturday ?? [],
        sunday: dto.weeklyAvailability.sunday ?? [],
      } as any;
    }

    if (dto.dateOverrides !== undefined) {
      settings.dateOverrides = dto.dateOverrides as any;
    }

    await settings.save();
    return settings;
  }

  async getPublicBookingSettingsBySlug(slug: string) {
    const { business, settings } = await this.resolvePublicContextBySlug(slug);

    return {
      business: {
        name: business.name,
        slug: business.slug,
        logoUrl: business.logoUrl ?? null,
        contactPhone: business.contactPhone ?? null,
        publicEmail: business.publicEmail ?? null,
        address: business.address ?? null,
        description: business.description ?? null,
      },
      booking: {
        enabled: settings.publicBookingEnabled,
        timezone: settings.timezone,
        slotDurationMinutes: settings.slotDurationMinutes,
        minAdvanceMinutes: settings.minAdvanceMinutes,
        maxAdvanceDays: settings.maxAdvanceDays,
      },
    };
  }

  async getPublicAvailabilityBySlug(slug: string, date: string) {
    const { business, settings, businessId } =
      await this.resolvePublicContextBySlug(slug);

    const slots = await this.buildAvailableSlots(businessId, settings, date);

    return {
      business: {
        name: business.name,
        slug: business.slug,
        timezone: settings.timezone,
      },
      date,
      slotDurationMinutes: settings.slotDurationMinutes,
      slots,
    };
  }

  async createPublicBookingBySlug(slug: string, dto: CreatePublicBookingDto) {
    const { business, settings, businessId } =
      await this.resolvePublicContextBySlug(slug);

    const slots = await this.buildAvailableSlots(businessId, settings, dto.date);

    const selectedSlot = slots.find(
      (slot) => slot.startTime === dto.startTime && slot.available,
    );

    if (!selectedSlot) {
      throw new BadRequestException('Selected slot is not available');
    }

    const event = await this.calendarEventModel.create({
      businessId,
      title: `Turno - ${dto.contactName}`,
      description: null,
      type: CalendarEventType.APPOINTMENT,
      status: CalendarEventStatus.PENDING,
      startAt: selectedSlot.startAt,
      endAt: selectedSlot.endAt,
      allDay: false,
      reminderMinutesBefore: null,
      assignedUserId: null,
      source: 'public_booking',
      contactName: dto.contactName,
      contactPhone: dto.contactPhone,
      contactEmail: dto.contactEmail ?? null,
      bookingDate: dto.date,
      bookingStartTime: selectedSlot.startTime,
      bookingEndTime: selectedSlot.endTime,
      location: business.address ?? null,
      notes: dto.notes ?? null,
      createdBy: null,
      updatedBy: null,
    });

    return {
      message: 'Booking created successfully',
      booking: event,
    };
  }

  async getDaySummary(currentUser: CurrentUser, date: string) {
    this.ensureBusinessContext(currentUser);

    const { start, end } = this.getDayRange(date);
    const businessId = this.toObjectId(currentUser.businessId, 'businessId');

    const [calendarEvents, manualExpenses, products] = await Promise.all([
      this.calendarEventModel
        .find({
          businessId,
          startAt: { $gte: start, $lt: end },
        })
        .sort({ startAt: 1, createdAt: -1 })
        .exec(),
      this.expenseModel
        .find({
          businessId,
          expenseDate: { $gte: start, $lt: end },
        })
        .sort({ expenseDate: 1, createdAt: -1 })
        .exec(),
      this.productModel.find({ businessId }).exec(),
    ]);

    const items: DaySummaryItem[] = [];

    for (const event of calendarEvents) {
      items.push({
        id: `calendar-${event.id}`,
        type: 'calendar_event',
        title: event.title,
        description: event.description ?? event.notes ?? null,
        date: event.startAt,
        direction: 'neutral',
        amount: null,
        currency: null,
        source: 'calendar',
        sourceId: event.id,
        meta: {
          eventType: event.type,
          status: event.status,
          endAt: event.endAt ?? null,
          allDay: event.allDay,
          source: event.source ?? 'internal',
          contactName: event.contactName ?? null,
          contactPhone: event.contactPhone ?? null,
          contactEmail: event.contactEmail ?? null,
          location: event.location ?? null,
        },
      });
    }

    for (const expense of manualExpenses) {
      items.push({
        id: `expense-${expense.id}`,
        type: 'manual_expense',
        title: expense.title,
        description: expense.description ?? expense.notes ?? null,
        date: expense.expenseDate,
        direction: 'out',
        amount: Number(expense.amount ?? 0),
        currency: expense.currency,
        source: 'expense',
        sourceId: expense.id,
        meta: {
          category: expense.category ?? null,
          paymentStatus: expense.paymentStatus,
          expenseType: expense.type,
        },
      });
    }

    for (const product of products) {
      const productId = product.id;
      const productName = product.name;
      const ownershipType =
        product.ownership?.ownershipType ?? ProductOwnershipType.OWNED;

      if (
        product.createdAt &&
        product.createdAt >= start &&
        product.createdAt < end
      ) {
        items.push({
          id: `product-created-${productId}`,
          type: 'product_created',
          title: `Producto creado - ${productName}`,
          description: 'Alta del producto',
          date: product.createdAt,
          direction: 'neutral',
          amount: null,
          currency: product.currency,
          source: 'product',
          sourceId: productId,
          meta: {
            productType: product.productType,
            ownershipType,
          },
        });
      }

      if (
        product.publishedAt &&
        product.publishedAt >= start &&
        product.publishedAt < end
      ) {
        items.push({
          id: `product-published-${productId}`,
          type: 'product_published',
          title: `Publicado - ${productName}`,
          description: 'Producto publicado',
          date: product.publishedAt,
          direction: 'neutral',
          amount: Number(product.salePrice ?? 0),
          currency: product.currency,
          source: 'product',
          sourceId: productId,
          meta: {
            productType: product.productType,
            ownershipType,
          },
        });
      }

      if (
        ownershipType === ProductOwnershipType.OWNED &&
        product.ownership?.purchasePrice != null &&
        product.ownership.purchaseDate &&
        product.ownership.purchaseDate >= start &&
        product.ownership.purchaseDate < end
      ) {
        items.push({
          id: `vehicle-purchase-${productId}`,
          type: 'vehicle_purchase',
          title: `Compra - ${productName}`,
          description: 'Compra de unidad propia',
          date: product.ownership.purchaseDate,
          direction: 'out',
          amount: Number(product.ownership.purchasePrice ?? 0),
          currency: product.currency,
          source: 'product',
          sourceId: productId,
          meta: {
            ownershipType,
          },
        });
      }

      const extraItems = product.finance?.extraExpenseItems ?? [];
      extraItems.forEach((item, index) => {
        const itemDate =
          item?.expenseDate ?? product.updatedAt ?? product.createdAt ?? null;

        if (!itemDate) return;
        if (itemDate < start || itemDate >= end) return;

        items.push({
          id: `product-extra-${productId}-${index}`,
          type: 'product_extra_expense',
          title: `${productName} - ${item.label}`,
          description: 'Gasto extra del producto',
          date: itemDate,
          direction: 'out',
          amount: Number(item.amount ?? 0),
          currency: product.currency,
          source: 'product',
          sourceId: productId,
          meta: {
            label: item.label,
          },
        });
      });

      if (
        product.reservation?.depositAmount != null &&
        product.reservation?.depositDate &&
        product.reservation.depositDate >= start &&
        product.reservation.depositDate < end
      ) {
        items.push({
          id: `deposit-${productId}`,
          type: 'deposit_received',
          title: `Seña recibida - ${productName}`,
          description: product.reservation.notes ?? null,
          date: product.reservation.depositDate,
          direction: 'in',
          amount: Number(product.reservation.depositAmount ?? 0),
          currency: product.reservation.depositCurrency ?? product.currency,
          source: 'product',
          sourceId: productId,
          meta: {
            customerName: product.reservation.customerName ?? null,
            customerPhone: product.reservation.customerPhone ?? null,
          },
        });
      }

      if (
        product.soldAt &&
        product.soldAt >= start &&
        product.soldAt < end &&
        product.finance?.finalSalePrice != null
      ) {
        items.push({
          id: `sale-${productId}`,
          type: 'product_sale',
          title: `Venta - ${productName}`,
          description: 'Venta final del producto',
          date: product.soldAt,
          direction: 'in',
          amount: Number(product.finance.finalSalePrice ?? 0),
          currency: product.currency,
          source: 'product',
          sourceId: productId,
          meta: {
            ownershipType,
          },
        });

        if (ownershipType === ProductOwnershipType.CONSIGNMENT) {
          const ownerExpectedAmount = Number(
            product.ownership?.ownerExpectedAmount ?? 0,
          );

          if (ownerExpectedAmount > 0) {
            items.push({
              id: `consignment-settlement-${productId}`,
              type: 'consignment_settlement',
              title: `Liquidación consignación - ${productName}`,
              description: 'Monto a entregar al dueño',
              date: product.soldAt,
              direction: 'out',
              amount: ownerExpectedAmount,
              currency: product.currency,
              source: 'product',
              sourceId: productId,
              meta: {
                consignorName: product.ownership?.consignorName ?? null,
                consignorPhone: product.ownership?.consignorPhone ?? null,
              },
            });
          }
        }
      }
    }

    const sortedItems = items.sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );

    const totals = sortedItems.reduce(
      (acc, item) => {
        const amount = Number(item.amount ?? 0);

        if (item.direction === 'in') {
          acc.income += amount;
        }

        if (item.direction === 'out') {
          acc.expenses += amount;
        }

        return acc;
      },
      {
        income: 0,
        expenses: 0,
      },
    );

    return {
      date,
      range: {
        start,
        end,
      },
      totals: {
        income: totals.income,
        expenses: totals.expenses,
        balance: totals.income - totals.expenses,
      },
      items: sortedItems,
    };
  }

  private serializeCalendarEvent(
    event: CalendarEventDocument,
  ): UnifiedCalendarEvent {
    return {
      id: event.id,
      _id: event.id,
      businessId: String(event.businessId),
      title: event.title,
      description: event.description ?? null,
      type: event.type as UnifiedCalendarEvent['type'],
      status: event.status as UnifiedCalendarEvent['status'],
      startAt: event.startAt,
      endAt: event.endAt ?? null,
      allDay: event.allDay ?? false,
      reminderMinutesBefore: event.reminderMinutesBefore ?? null,
      assignedUserId: event.assignedUserId
        ? String(event.assignedUserId)
        : null,
      source:
        event.source === 'public_booking' ? 'public_booking' : 'calendar',
      contactName: event.contactName ?? null,
      contactPhone: event.contactPhone ?? null,
      contactEmail: event.contactEmail ?? null,
      location: event.location ?? null,
      notes: event.notes ?? null,
      createdAt: event.createdAt ?? null,
      updatedAt: event.updatedAt ?? null,
      readOnly: false,
    };
  }

  private buildExpenseCalendarEvents(
    expenses: ExpenseDocument[],
    range: { dateFrom: Date | null; dateTo: Date | null },
  ): UnifiedCalendarEvent[] {
    const items: UnifiedCalendarEvent[] = [];
    const rangeStart = range.dateFrom ?? new Date(2000, 0, 1);
    const rangeEnd = range.dateTo ?? new Date(2100, 0, 1);

    for (const expense of expenses) {
      if (!expense.calendarEnabled) continue;

      const baseDate = this.normalizeExpenseCalendarBaseDate(expense);
      if (!baseDate) continue;

      const recurrenceEndDate = expense.recurrenceEndDate ?? null;

      const pushOne = (occurrenceDate: Date, occurrenceIndex: number) => {
        if (occurrenceDate < rangeStart || occurrenceDate > rangeEnd) return;

        const isPending =
          expense.paymentStatus === ExpensePaymentStatus.PENDING;

        items.push({
          id: `expense-calendar-${expense.id}-${occurrenceIndex}`,
          _id: `expense-calendar-${expense.id}-${occurrenceIndex}`,
          businessId: String(expense.businessId),
          title: isPending
            ? `Vence: ${expense.title}`
            : `Gasto: ${expense.title}`,
          description: expense.description ?? expense.notes ?? null,
          type: isPending ? 'deadline' : 'task',
          status: isPending ? 'pending' : 'completed',
          startAt: occurrenceDate,
          endAt: null,
          allDay: true,
          reminderMinutesBefore: null,
          assignedUserId: null,
          source: 'expense_calendar',
          contactName: null,
          contactPhone: null,
          contactEmail: null,
          location: null,
          notes: expense.notes ?? null,
          createdAt: expense.createdAt ?? occurrenceDate,
          updatedAt: expense.updatedAt ?? occurrenceDate,
          readOnly: true,
          meta: {
            expenseId: expense.id,
            expenseTitle: expense.title,
            expenseCategory: expense.category ?? null,
            expenseAmount: expense.amount,
            expenseCurrency: expense.currency,
            expensePaymentStatus: expense.paymentStatus,
            expenseType: expense.type,
            expenseDate: expense.expenseDate,
            dueDate: expense.dueDate ?? null,
            isRecurring: expense.isRecurring ?? false,
            recurrence: expense.recurrence ?? null,
            recurrenceEndDate: expense.recurrenceEndDate ?? null,
            occurrenceIndex,
          },
        });
      };

      if (!expense.isRecurring || !expense.recurrence) {
        pushOne(baseDate, 0);
        continue;
      }

      let cursor = new Date(baseDate);
      let guard = 0;

      while (cursor <= rangeEnd && guard < 500) {
        if (recurrenceEndDate && cursor > recurrenceEndDate) break;

        pushOne(new Date(cursor), guard);

        const next = this.getNextRecurrenceDate(cursor, expense.recurrence);
        if (!next) break;

        cursor = next;
        guard += 1;
      }
    }

    return items;
  }

  private buildProductCalendarEvents(
    products: ProductDocument[],
    range: { dateFrom: Date | null; dateTo: Date | null },
  ): UnifiedCalendarEvent[] {
    const items: UnifiedCalendarEvent[] = [];
    const rangeStart = range.dateFrom ?? new Date(2000, 0, 1);
    const rangeEnd = range.dateTo ?? new Date(2100, 0, 1);

    const isWithinRange = (date?: Date | null) =>
      !!date && date >= rangeStart && date <= rangeEnd;

    for (const product of products) {
      const productId = product.id;
      const ownershipType =
        product.ownership?.ownershipType ?? ProductOwnershipType.OWNED;

      if (isWithinRange(product.createdAt)) {
        items.push({
          id: `product-created-${productId}`,
          _id: `product-created-${productId}`,
          businessId: String(product.businessId),
          title: `Producto creado: ${product.name}`,
          description: product.description ?? 'Alta del producto',
          type: 'task',
          status: 'completed',
          startAt: product.createdAt!,
          endAt: null,
          allDay: true,
          reminderMinutesBefore: null,
          assignedUserId: null,
          source: 'product_calendar',
          contactName: null,
          contactPhone: null,
          contactEmail: null,
          location: null,
          notes: null,
          createdAt: product.createdAt ?? null,
          updatedAt: product.updatedAt ?? null,
          readOnly: true,
          meta: {
            sourceType: 'product_created',
            productId,
            productType: product.productType,
          },
        });
      }

      if (isWithinRange(product.publishedAt)) {
        items.push({
          id: `product-published-${productId}`,
          _id: `product-published-${productId}`,
          businessId: String(product.businessId),
          title: `Producto publicado: ${product.name}`,
          description: 'Publicado en catálogo',
          type: 'task',
          status: 'completed',
          startAt: product.publishedAt!,
          endAt: null,
          allDay: true,
          reminderMinutesBefore: null,
          assignedUserId: null,
          source: 'product_calendar',
          contactName: null,
          contactPhone: null,
          contactEmail: null,
          location: null,
          notes: null,
          createdAt: product.createdAt ?? null,
          updatedAt: product.updatedAt ?? null,
          readOnly: true,
          meta: {
            sourceType: 'product_published',
            productId,
          },
        });
      }

      if (
        ownershipType === ProductOwnershipType.OWNED &&
        product.ownership?.purchasePrice != null &&
        isWithinRange(product.ownership?.purchaseDate ?? null)
      ) {
        items.push({
          id: `product-purchase-${productId}`,
          _id: `product-purchase-${productId}`,
          businessId: String(product.businessId),
          title: `Compra: ${product.name}`,
          description: 'Compra de unidad propia',
          type: 'deadline',
          status: 'completed',
          startAt: product.ownership.purchaseDate!,
          endAt: null,
          allDay: true,
          reminderMinutesBefore: null,
          assignedUserId: null,
          source: 'product_calendar',
          contactName: null,
          contactPhone: null,
          contactEmail: null,
          location: null,
          notes: null,
          createdAt: product.createdAt ?? null,
          updatedAt: product.updatedAt ?? null,
          readOnly: true,
          meta: {
            sourceType: 'vehicle_purchase',
            productId,
            amount: product.ownership.purchasePrice ?? 0,
            currency: product.currency,
          },
        });
      }

      const extraItems = product.finance?.extraExpenseItems ?? [];
      extraItems.forEach((item, index) => {
        const itemDate =
          item?.expenseDate ?? product.updatedAt ?? product.createdAt ?? null;

        if (!isWithinRange(itemDate)) return;

        items.push({
          id: `product-extra-${productId}-${index}`,
          _id: `product-extra-${productId}-${index}`,
          businessId: String(product.businessId),
          title: `${product.name} - ${item.label}`,
          description: 'Gasto extra del producto',
          type: 'deadline',
          status: 'completed',
          startAt: itemDate!,
          endAt: null,
          allDay: true,
          reminderMinutesBefore: null,
          assignedUserId: null,
          source: 'product_calendar',
          contactName: null,
          contactPhone: null,
          contactEmail: null,
          location: null,
          notes: product.finance?.internalNotes ?? null,
          createdAt: product.createdAt ?? null,
          updatedAt: product.updatedAt ?? null,
          readOnly: true,
          meta: {
            sourceType: 'product_extra_expense',
            productId,
            label: item.label,
            amount: Number(item.amount ?? 0),
            currency: product.currency,
          },
        });
      });

      if (
        product.reservation?.depositAmount != null &&
        isWithinRange(product.reservation?.depositDate ?? null)
      ) {
        items.push({
          id: `product-deposit-${productId}`,
          _id: `product-deposit-${productId}`,
          businessId: String(product.businessId),
          title: `Seña recibida: ${product.name}`,
          description: product.reservation?.notes ?? null,
          type: 'meeting',
          status: 'completed',
          startAt: product.reservation.depositDate!,
          endAt: null,
          allDay: true,
          reminderMinutesBefore: null,
          assignedUserId: null,
          source: 'product_calendar',
          contactName: product.reservation?.customerName ?? null,
          contactPhone: product.reservation?.customerPhone ?? null,
          contactEmail: null,
          location: null,
          notes: product.reservation?.notes ?? null,
          createdAt: product.createdAt ?? null,
          updatedAt: product.updatedAt ?? null,
          readOnly: true,
          meta: {
            sourceType: 'deposit_received',
            productId,
            amount: Number(product.reservation.depositAmount ?? 0),
            currency:
              product.reservation.depositCurrency ?? product.currency,
          },
        });
      }

      if (isWithinRange(product.soldAt ?? null)) {
        items.push({
          id: `product-sale-${productId}`,
          _id: `product-sale-${productId}`,
          businessId: String(product.businessId),
          title: `Venta: ${product.name}`,
          description: 'Venta del producto',
          type: 'meeting',
          status: 'completed',
          startAt: product.soldAt!,
          endAt: null,
          allDay: true,
          reminderMinutesBefore: null,
          assignedUserId: null,
          source: 'product_calendar',
          contactName: null,
          contactPhone: null,
          contactEmail: null,
          location: null,
          notes: null,
          createdAt: product.createdAt ?? null,
          updatedAt: product.updatedAt ?? null,
          readOnly: true,
          meta: {
            sourceType: 'product_sale',
            productId,
            amount:
              Number(product.finance?.finalSalePrice ?? 0) ||
              Number(product.salePrice ?? 0),
            currency: product.currency,
          },
        });

        if (
          ownershipType === ProductOwnershipType.CONSIGNMENT &&
          Number(product.ownership?.ownerExpectedAmount ?? 0) > 0
        ) {
          items.push({
            id: `product-consignment-${productId}`,
            _id: `product-consignment-${productId}`,
            businessId: String(product.businessId),
            title: `Liquidación consignación: ${product.name}`,
            description: 'Monto a entregar al dueño',
            type: 'deadline',
            status: 'completed',
            startAt: product.soldAt!,
            endAt: null,
            allDay: true,
            reminderMinutesBefore: null,
            assignedUserId: null,
            source: 'product_calendar',
            contactName: product.ownership?.consignorName ?? null,
            contactPhone: product.ownership?.consignorPhone ?? null,
            contactEmail: null,
            location: null,
            notes: null,
            createdAt: product.createdAt ?? null,
            updatedAt: product.updatedAt ?? null,
            readOnly: true,
            meta: {
              sourceType: 'consignment_settlement',
              productId,
              amount: Number(product.ownership?.ownerExpectedAmount ?? 0),
              currency: product.currency,
            },
          });
        }
      }
    }

    return items;
  }

  private normalizeExpenseCalendarBaseDate(expense: ExpenseDocument) {
    const raw = expense.dueDate ?? expense.expenseDate ?? null;
    if (!raw) return null;

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;

    return parsed;
  }

  private getNextRecurrenceDate(
    date: Date,
    recurrence?: ExpenseRecurrence | null,
  ) {
    const next = new Date(date);

    switch (recurrence) {
      case ExpenseRecurrence.DAILY:
        next.setDate(next.getDate() + 1);
        return next;
      case ExpenseRecurrence.WEEKLY:
        next.setDate(next.getDate() + 7);
        return next;
      case ExpenseRecurrence.MONTHLY:
        next.setMonth(next.getMonth() + 1);
        return next;
      case ExpenseRecurrence.YEARLY:
        next.setFullYear(next.getFullYear() + 1);
        return next;
      default:
        return null;
    }
  }

  private async resolvePublicContextBySlug(slug: string) {
    const business = await this.businessesService.findBySlug(slug);

    if (!business || !business.isActive) {
      throw new NotFoundException('Business not found');
    }

    const businessId = this.toObjectId(
      String((business as any)._id),
      'businessId',
    );

    const settings = await this.calendarSettingsModel.findOne({ businessId }).exec();

    if (!settings || !settings.publicBookingEnabled) {
      throw new BadRequestException('Public booking is not enabled');
    }

    return {
      business,
      businessId,
      settings,
    };
  }

  private async buildAvailableSlots(
    businessId: Types.ObjectId,
    settings: CalendarSettingsDocument,
    date: string,
  ) {
    const { start, end } = this.getDayRange(date);
    const dayKey = this.getDayKey(start);

    const override = (settings.dateOverrides ?? []).find(
      (item) => item.date === date,
    );

    const ranges = override
      ? override.isClosed
        ? []
        : override.ranges ?? []
      : settings.weeklyAvailability?.[dayKey] ?? [];

    if (!ranges.length) {
      return [];
    }

    const now = new Date();
    const minAllowedAt = new Date(
      now.getTime() + settings.minAdvanceMinutes * 60 * 1000,
    );
    const maxAllowedAt = new Date(
      now.getTime() + settings.maxAdvanceDays * 24 * 60 * 60 * 1000,
    );

    const existingEvents = await this.calendarEventModel
      .find({
        businessId,
        status: { $ne: CalendarEventStatus.CANCELED },
        startAt: { $lt: end },
        $or: [
          { endAt: { $gt: start } },
          { endAt: null, startAt: { $gte: start, $lt: end } },
        ],
      })
      .sort({ startAt: 1 })
      .exec();

    const slots: Array<{
      startAt: Date;
      endAt: Date;
      startTime: string;
      endTime: string;
      available: boolean;
    }> = [];

    for (const range of ranges) {
      const rangeStartMinutes = this.timeToMinutes(range.start);
      const rangeEndMinutes = this.timeToMinutes(range.end);

      let cursor = rangeStartMinutes;

      while (cursor + settings.slotDurationMinutes <= rangeEndMinutes) {
        const slotStart = this.buildDateFromMinutes(start, cursor);
        const slotEnd = this.buildDateFromMinutes(
          start,
          cursor + settings.slotDurationMinutes,
        );

        const overlaps = existingEvents.some((event) => {
          const eventStart = new Date(event.startAt);
          const eventEnd = event.endAt
            ? new Date(event.endAt)
            : new Date(event.startAt);

          return slotStart < eventEnd && slotEnd > eventStart;
        });

        const available =
          slotStart >= minAllowedAt &&
          slotStart <= maxAllowedAt &&
          !overlaps;

        slots.push({
          startAt: slotStart,
          endAt: slotEnd,
          startTime: this.minutesToTime(cursor),
          endTime: this.minutesToTime(cursor + settings.slotDurationMinutes),
          available,
        });

        cursor += settings.slotDurationMinutes;
      }
    }

    return slots;
  }

  private buildFilters(
    businessId: string,
    query: FindCalendarEventsDto,
  ): FilterQuery<CalendarEventDocument> {
    const filters: FilterQuery<CalendarEventDocument> = {
      businessId: this.toObjectId(businessId, 'businessId'),
    };

    if (query.type) {
      filters.type = query.type;
    }

    if (query.status) {
      filters.status = query.status;
    }

    if (query.assignedUserId) {
      filters.assignedUserId = this.toObjectId(
        query.assignedUserId,
        'assignedUserId',
      );
    }

    if (query.dateFrom || query.dateTo) {
      filters.startAt = {};

      if (query.dateFrom) {
        filters.startAt.$gte = this.parseDate(query.dateFrom, 'dateFrom');
      }

      if (query.dateTo) {
        filters.startAt.$lte = this.parseDate(query.dateTo, 'dateTo');
      }
    }

    return filters;
  }

  private getDayRange(date: string) {
    const parsed = this.parseDateOnly(date, 'date');
    const start = new Date(
      parsed.getFullYear(),
      parsed.getMonth(),
      parsed.getDate(),
      0,
      0,
      0,
      0,
    );
    const end = new Date(
      parsed.getFullYear(),
      parsed.getMonth(),
      parsed.getDate() + 1,
      0,
      0,
      0,
      0,
    );

    return { start, end };
  }

  private parseDate(value: string, fieldName: string) {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid ${fieldName}`);
    }

    return parsed;
  }

  private parseDateOnly(value: string, fieldName: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    if (!match) {
      throw new BadRequestException(`Invalid ${fieldName}, expected YYYY-MM-DD`);
    }

    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);

    const parsed = new Date(year, month, day);

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

  private buildDefaultWeeklyAvailability() {
    return {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    };
  }

  private getDayKey(date: Date) {
    const days = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ] as const;

    return days[date.getDay()];
  }

  private timeToMinutes(value: string) {
    const match = /^(\d{2}):(\d{2})$/.exec(value);

    if (!match) {
      throw new BadRequestException('Invalid time format, expected HH:mm');
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);

    return hours * 60 + minutes;
  }

  private minutesToTime(totalMinutes: number) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
      2,
      '0',
    )}`;
  }

  private buildDateFromMinutes(baseDate: Date, totalMinutes: number) {
    const date = new Date(baseDate);
    date.setHours(0, 0, 0, 0);
    date.setMinutes(totalMinutes);
    return date;
  }
}