import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { CalendarEventStatus } from '../../../common/enums/calendar-event-status.enum';
import { CalendarEventType } from '../../../common/enums/calendar-event-type.enum';

export type CalendarEventDocument = HydratedDocument<CalendarEvent>;

@Schema({ timestamps: true })
export class CalendarEvent {
  createdAt?: Date;
  updatedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Business', required: true, index: true })
  businessId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ type: String, default: null, trim: true })
  description?: string | null;

  @Prop({
    type: String,
    enum: CalendarEventType,
    required: true,
    index: true,
  })
  type!: CalendarEventType;

  @Prop({
    type: String,
    enum: CalendarEventStatus,
    default: CalendarEventStatus.PENDING,
    index: true,
  })
  status!: CalendarEventStatus;

  @Prop({ type: Date, required: true, index: true })
  startAt!: Date;

  @Prop({ type: Date, default: null, index: true })
  endAt?: Date | null;

  @Prop({ type: Boolean, default: false })
  allDay!: boolean;

  @Prop({ type: Number, default: null, min: 0 })
  reminderMinutesBefore?: number | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  assignedUserId?: Types.ObjectId | null;

  @Prop({ type: String, default: 'internal', index: true })
  source?: 'internal' | 'public_booking';

  @Prop({ type: String, default: null, trim: true })
  contactName?: string | null;

  @Prop({ type: String, default: null, trim: true })
  contactPhone?: string | null;

  @Prop({ type: String, default: null, trim: true })
  contactEmail?: string | null;

  @Prop({ type: String, default: null, trim: true })
  bookingDate?: string | null;

  @Prop({ type: String, default: null, trim: true })
  bookingStartTime?: string | null;

  @Prop({ type: String, default: null, trim: true })
  bookingEndTime?: string | null;

  @Prop({ type: String, default: null, trim: true })
  location?: string | null;

  @Prop({ type: String, default: null, trim: true })
  notes?: string | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  createdBy?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  updatedBy?: Types.ObjectId | null;
}

export const CalendarEventSchema =
  SchemaFactory.createForClass(CalendarEvent);

CalendarEventSchema.index({ businessId: 1, startAt: -1 });
CalendarEventSchema.index({ businessId: 1, type: 1, startAt: -1 });
CalendarEventSchema.index({ businessId: 1, status: 1, startAt: -1 });
CalendarEventSchema.index({ businessId: 1, assignedUserId: 1, startAt: -1 });
CalendarEventSchema.index({ businessId: 1, source: 1, startAt: -1 });