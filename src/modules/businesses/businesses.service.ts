import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';

import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-businesses.dto';
import { UpdateMyBusinessProfileDto } from './dto/update-my-business-profile.dto';
import { Business, BusinessDocument } from './schemas/businesses.schema';

@Injectable()
export class BusinessesService {
  constructor(
    @InjectModel(Business.name)
    private readonly businessModel: Model<BusinessDocument>,
  ) {}

  async create(dto: CreateBusinessDto) {
    const normalizedSlug = this.normalizeSlug(dto.slug);

    const existing = await this.findBySlug(normalizedSlug);
    if (existing) {
      throw new ConflictException('Business slug already in use');
    }

    return this.businessModel.create({
      ...dto,
      slug: normalizedSlug,
    });
  }

  async findAll() {
    return this.businessModel.find().sort({ createdAt: -1 }).exec();
  }

  async findBySlug(slug: string) {
    return this.businessModel.findOne({ slug: slug.toLowerCase() }).exec();
  }

  async findById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid business id');
    }

    const business = await this.businessModel.findById(id).exec();

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    return business;
  }

  async getMyBusiness(currentUser: CurrentUser) {
    this.ensureBusinessContext(currentUser);
    return this.findById(currentUser.businessId);
  }

  async updateMyBusinessProfile(
    dto: UpdateMyBusinessProfileDto,
    currentUser: CurrentUser,
  ) {
    this.ensureBusinessContext(currentUser);

    const business = await this.findById(currentUser.businessId);

    let normalizedSlug: string | undefined = undefined;

    if (dto.slug !== undefined) {
      normalizedSlug = this.normalizeSlug(dto.slug);

      const existingSlug = await this.findBySlug(normalizedSlug);
      if (existingSlug && existingSlug.id !== business.id) {
        throw new ConflictException('Business slug already in use');
      }
    }

    const updatedBusiness = await this.businessModel.findByIdAndUpdate(
      currentUser.businessId,
      {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(normalizedSlug !== undefined ? { slug: normalizedSlug } : {}),
        ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
        ...(dto.contactPhone !== undefined
          ? { contactPhone: dto.contactPhone }
          : {}),
        ...(dto.publicEmail !== undefined
          ? { publicEmail: dto.publicEmail }
          : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.primaryColor !== undefined
          ? { primaryColor: dto.primaryColor }
          : {}),
        ...(dto.secondaryColor !== undefined
          ? { secondaryColor: dto.secondaryColor }
          : {}),
      },
      { new: true },
    );

    if (!updatedBusiness) {
      throw new NotFoundException('Business not found');
    }

    return updatedBusiness;
  }

  async updateById(id: string, dto: UpdateBusinessDto) {
    await this.findById(id);

    if (dto.slug) {
      const normalizedSlug = this.normalizeSlug(dto.slug);
      const existingSlug = await this.findBySlug(normalizedSlug);

      if (existingSlug && existingSlug.id !== id) {
        throw new ConflictException('Business slug already in use');
      }
    }

    const business = await this.businessModel.findByIdAndUpdate(
      id,
      {
        ...dto,
        ...(dto.slug ? { slug: this.normalizeSlug(dto.slug) } : {}),
      },
      { new: true },
    );

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    return business;
  }

  async setActive(id: string, isActive: boolean) {
    await this.findById(id);

    const business = await this.businessModel.findByIdAndUpdate(
      id,
      { isActive },
      { new: true },
    );

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    return business;
  }

  private normalizeSlug(value: string) {
    const slug = value
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');

    if (!slug) {
      throw new BadRequestException('Invalid business slug');
    }

    return slug;
  }

  private ensureBusinessContext(currentUser: CurrentUser) {
    if (!currentUser.businessId) {
      throw new BadRequestException(
        'This action requires a business-scoped user',
      );
    }
  }
}