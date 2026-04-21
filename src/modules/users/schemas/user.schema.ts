import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { UserRole } from 'src/common/enums/user-role.enum';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  createdAt?: Date;
  updatedAt?: Date;

  @Prop({
    type: Types.ObjectId,
    ref: 'Business',
    required: false,
    default: null,
    index: true,
  })
  businessId?: Types.ObjectId | null;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true })
  passwordHash!: string;

  @Prop({ enum: UserRole, default: UserRole.EDITOR })
  role!: UserRole;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ type: String, default: null })
  refreshTokenHash?: string | null;

  @Prop({ type: Date, default: null })
  lastLoginAt?: Date | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ businessId: 1, role: 1 });