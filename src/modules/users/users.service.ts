import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as argon2 from 'argon2';
import { Model, Types } from 'mongoose';
import { UserRole } from '../../common/enums/user-role.enum';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { BusinessesService } from '../businesses/businesses.service';
import { CreateUserBySuperAdminDto } from './dto/create-user-by-super-admin.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserBySuperAdminDto } from './dto/update-user-by-super-admin.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly businessesService: BusinessesService,
  ) {}

  async createInternal(input: {
    businessId?: string;
    name: string;
    email: string;
    passwordHash: string;
    role: UserRole;
  }) {
    const payload: Partial<User> & {
      name: string;
      email: string;
      passwordHash: string;
      role: UserRole;
      isActive: boolean;
    } = {
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      role: input.role,
      isActive: true,
    };

    if (input.businessId) {
      payload.businessId = new Types.ObjectId(input.businessId);
    }

    const user = await this.userModel.create(payload);
    return user;
  }

  async countByRole(role: UserRole) {
    return this.userModel.countDocuments({ role }).exec();
  }

  async create(dto: CreateUserDto, currentUser: CurrentUser) {
    this.ensureBusinessContext(currentUser);

    const existing = await this.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    if (![UserRole.ADMIN, UserRole.EDITOR].includes(dto.role)) {
      throw new BadRequestException(
        'OWNER can only create ADMIN or EDITOR users',
      );
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.createInternal({
      businessId: currentUser.businessId,
      name: dto.name,
      email: dto.email,
      passwordHash,
      role: dto.role,
    });

    return this.toSafeUser(user);
  }

  async createBySuperAdmin(dto: CreateUserBySuperAdminDto) {
    const existing = await this.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    await this.businessesService.findById(dto.businessId);

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.createInternal({
      businessId: dto.businessId,
      name: dto.name,
      email: dto.email,
      passwordHash,
      role: dto.role,
    });

    return this.toSafeUser(user);
  }

  async findAllByBusiness(currentUser: CurrentUser) {
    this.ensureBusinessContext(currentUser);

    const users = await this.userModel
      .find({ businessId: currentUser.businessId })
      .sort({ createdAt: -1 })
      .exec();

    return users.map((user) => this.toSafeUser(user));
  }

  async findAllByBusinessId(businessId: string) {
    await this.businessesService.findById(businessId);

    const users = await this.userModel
      .find({ businessId })
      .sort({ createdAt: -1 })
      .exec();

    return users.map((user) => this.toSafeUser(user));
  }

  async findAllGlobal() {
    const users = await this.userModel.find().sort({ createdAt: -1 }).exec();
    return users.map((user) => this.toSafeUser(user));
  }

  async findByEmail(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  async findById(userId: string) {
    const user = await this.userModel.findById(userId).exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async update(userId: string, dto: UpdateUserDto, currentUser: CurrentUser) {
    this.ensureBusinessContext(currentUser);

    const user = await this.userModel.findOne({
      _id: userId,
      businessId: currentUser.businessId,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.email && dto.email.toLowerCase() !== user.email) {
      const existing = await this.findByEmail(dto.email);
      if (existing) {
        throw new ConflictException('Email already in use');
      }
      user.email = dto.email.toLowerCase();
    }

    if (dto.name !== undefined) {
      user.name = dto.name;
    }

    if (dto.role !== undefined) {
      if (![UserRole.ADMIN, UserRole.EDITOR].includes(dto.role)) {
        throw new BadRequestException(
          'OWNER can only assign ADMIN or EDITOR roles',
        );
      }
      user.role = dto.role;
    }

    if (dto.password !== undefined) {
      user.passwordHash = await argon2.hash(dto.password);
    }

    await user.save();
    return this.toSafeUser(user);
  }

  async updateBySuperAdmin(userId: string, dto: UpdateUserBySuperAdminDto) {
    const user = await this.findById(userId);

    if (dto.email && dto.email.toLowerCase() !== user.email) {
      const existing = await this.findByEmail(dto.email);
      if (existing) {
        throw new ConflictException('Email already in use');
      }
      user.email = dto.email.toLowerCase();
    }

    if (dto.name !== undefined) {
      user.name = dto.name;
    }

    if (dto.businessId !== undefined) {
      await this.businessesService.findById(dto.businessId);
      user.businessId = new Types.ObjectId(dto.businessId);
    }

    if (dto.role !== undefined) {
      if (
        ![UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR].includes(dto.role)
      ) {
        throw new BadRequestException(
          'SUPER_ADMIN can only assign OWNER, ADMIN or EDITOR roles from this endpoint',
        );
      }

      if (!user.businessId && !dto.businessId) {
        throw new BadRequestException(
          'A businessId is required for business-scoped roles',
        );
      }

      user.role = dto.role;
    }

    if (dto.password !== undefined) {
      user.passwordHash = await argon2.hash(dto.password);
      user.refreshTokenHash = null;
    }

    await user.save();
    return this.toSafeUser(user);
  }

  async setActive(userId: string, isActive: boolean, currentUser: CurrentUser) {
    this.ensureBusinessContext(currentUser);

    const user = await this.userModel.findOneAndUpdate(
      { _id: userId, businessId: currentUser.businessId },
      { isActive },
      { new: true },
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toSafeUser(user);
  }

  async setActiveBySuperAdmin(userId: string, isActive: boolean) {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { isActive },
      { new: true },
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toSafeUser(user);
  }

  async resetPassword(userId: string, newPassword: string) {
    const passwordHash = await argon2.hash(newPassword);

    const user = await this.userModel.findByIdAndUpdate(
      userId,
      {
        passwordHash,
        refreshTokenHash: null,
      },
      { new: true },
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      message: 'Password reset successfully',
      user: this.toSafeUser(user),
    };
  }

  async setRefreshTokenHash(userId: string, refreshToken: string) {
    const refreshTokenHash = await argon2.hash(refreshToken);
    await this.userModel.findByIdAndUpdate(userId, { refreshTokenHash }).exec();
  }

  async clearRefreshTokenHash(userId: string) {
    await this.userModel.findByIdAndUpdate(userId, {
      refreshTokenHash: null,
    }).exec();
  }

  async touchLastLogin(userId: string) {
    await this.userModel.findByIdAndUpdate(userId, {
      lastLoginAt: new Date(),
    }).exec();
  }

  toSafeUser(user: UserDocument | null) {
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      businessId: user.businessId ? user.businessId.toString() : '',
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private ensureBusinessContext(currentUser: CurrentUser) {
    if (!currentUser.businessId) {
      throw new BadRequestException(
        'This action requires a business-scoped user',
      );
    }
  }
}