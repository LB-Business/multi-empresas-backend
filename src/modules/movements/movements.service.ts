import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { Movement, MovementDocument } from './schema/movements.schema';

export type MovementDirection = 'in' | 'out' | 'neutral';

export interface CreateMovementInput {
  type: string;
  title: string;
  description?: string | null;
  meta?: Record<string, any>;
  amount?: number | null;
  direction?: MovementDirection;
  date?: Date;
}

@Injectable()
export class MovementsService {
  constructor(
    @InjectModel(Movement.name)
    private readonly movementModel: Model<MovementDocument>,
  ) {}

  async createMovement(
    input: CreateMovementInput,
    currentUser: CurrentUser,
  ): Promise<MovementDocument> {
    if (!currentUser.businessId) {
      throw new BadRequestException('User must belong to a business');
    }

    const movementDate = input.date ?? new Date();

    const doc = await this.movementModel.create({
      ...input,
      id: new Types.ObjectId().toHexString(),
      businessId: currentUser.businessId,
      date: movementDate,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return doc;
  }

  async getMovements(
    currentUser: CurrentUser,
    month?: string,
  ): Promise<MovementDocument[]> {
    if (!currentUser.businessId) {
      throw new BadRequestException('User must belong to a business');
    }

    const { start, end } = this.getMonthRange(month);

    return this.movementModel
      .find({
        businessId: currentUser.businessId,
        date: { $gte: start, $lt: end },
      })
      .sort({ date: -1, createdAt: -1 })
      .exec();
  }

  async getMovementsByDay(
    currentUser: CurrentUser,
    date: string,
  ): Promise<{
    date: string;
    range: { start: Date; end: Date };
    totals: { income: number; expenses: number; balance: number };
    items: MovementDocument[];
  }> {
    if (!currentUser.businessId) {
      throw new BadRequestException('User must belong to a business');
    }

    const { start, end } = this.getDayRange(date);

    const items = await this.movementModel
      .find({
        businessId: currentUser.businessId,
        date: { $gte: start, $lt: end },
      })
      .sort({ date: 1, createdAt: 1 })
      .exec();

    const totals = items.reduce(
      (acc, item) => {
        const amount = Number(item.amount ?? 0);

        if (item.direction === 'in') acc.income += amount;
        if (item.direction === 'out') acc.expenses += amount;

        return acc;
      },
      {
        income: 0,
        expenses: 0,
      },
    );

    return {
      date,
      range: { start, end },
      totals: {
        income: totals.income,
        expenses: totals.expenses,
        balance: totals.income - totals.expenses,
      },
      items,
    };
  }

  private getMonthRange(month?: string) {
    if (!month) {
      const now = new Date();
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
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

    return {
      start: new Date(year, monthIndex, 1),
      end: new Date(year, monthIndex + 1, 1),
    };
  }

  private getDayRange(date: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

    if (!match) {
      throw new BadRequestException('date must have YYYY-MM-DD format');
    }

    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const day = Number(match[3]);

    const start = new Date(year, monthIndex, day, 0, 0, 0, 0);
    const end = new Date(year, monthIndex, day + 1, 0, 0, 0, 0);

    return { start, end };
  }
}