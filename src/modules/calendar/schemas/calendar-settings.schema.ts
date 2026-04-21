import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CalendarSettingsDocument = HydratedDocument<CalendarSettings>;

@Schema({ _id: false })
class AvailabilityRange {
  @Prop({ required: true, trim: true })
  start!: string;

  @Prop({ required: true, trim: true })
  end!: string;
}

@Schema({ _id: false })
class DateOverride {
  @Prop({ required: true, trim: true })
  date!: string;

  @Prop({ type: Boolean, default: false })
  isClosed!: boolean;

  @Prop({ type: [AvailabilityRange], default: [] })
  ranges!: AvailabilityRange[];
}

@Schema({ _id: false })
class WeeklyAvailability {
  @Prop({ type: [AvailabilityRange], default: [] })
  monday!: AvailabilityRange[];

  @Prop({ type: [AvailabilityRange], default: [] })
  tuesday!: AvailabilityRange[];

  @Prop({ type: [AvailabilityRange], default: [] })
  wednesday!: AvailabilityRange[];

  @Prop({ type: [AvailabilityRange], default: [] })
  thursday!: AvailabilityRange[];

  @Prop({ type: [AvailabilityRange], default: [] })
  friday!: AvailabilityRange[];

  @Prop({ type: [AvailabilityRange], default: [] })
  saturday!: AvailabilityRange[];

  @Prop({ type: [AvailabilityRange], default: [] })
  sunday!: AvailabilityRange[];
}

@Schema({ timestamps: true })
export class CalendarSettings {
  createdAt?: Date;
  updatedAt?: Date;

  @Prop({
    type: Types.ObjectId,
    ref: 'Business',
    required: true,
    unique: true,
    index: true,
  })
  businessId!: Types.ObjectId;

  @Prop({ type: Boolean, default: false })
  publicBookingEnabled!: boolean;

  @Prop({ type: String, default: 'America/Argentina/Buenos_Aires' })
  timezone!: string;

  @Prop({ type: Number, default: 30, min: 5 })
  slotDurationMinutes!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  minAdvanceMinutes!: number;

  @Prop({ type: Number, default: 30, min: 1 })
  maxAdvanceDays!: number;

  @Prop({
    type: WeeklyAvailability,
    default: () => ({
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    }),
  })
  weeklyAvailability!: WeeklyAvailability;

  @Prop({ type: [DateOverride], default: [] })
  dateOverrides!: DateOverride[];
}

export const CalendarSettingsSchema =
  SchemaFactory.createForClass(CalendarSettings);