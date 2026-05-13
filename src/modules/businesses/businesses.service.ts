import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CurrentUser } from '../../common/interfaces/current-user.interface';

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
        ...(dto.name !== undefined
          ? { name: this.normalizeNullableString(dto.name) }
          : {}),
        ...(normalizedSlug !== undefined ? { slug: normalizedSlug } : {}),
        ...(dto.logoUrl !== undefined
          ? { logoUrl: this.normalizeNullableString(dto.logoUrl) }
          : {}),
        ...(dto.contactPhone !== undefined
          ? { contactPhone: this.normalizeNullableString(dto.contactPhone) }
          : {}),
        ...(dto.publicEmail !== undefined
          ? { publicEmail: this.normalizeNullableString(dto.publicEmail) }
          : {}),
        ...(dto.address !== undefined
          ? { address: this.normalizeNullableString(dto.address) }
          : {}),
        ...(dto.description !== undefined
          ? { description: this.normalizeNullableString(dto.description) }
          : {}),
        ...(dto.primaryColor !== undefined
          ? { primaryColor: this.normalizeNullableString(dto.primaryColor) }
          : {}),
        ...(dto.secondaryColor !== undefined
          ? { secondaryColor: this.normalizeNullableString(dto.secondaryColor) }
          : {}),
      },
      { new: true },
    );

    if (!updatedBusiness) {
      throw new NotFoundException('Business not found');
    }

    return updatedBusiness;
  }

  async getPublicBusinessProfile(slug: string) {
    const normalizedSlug = this.normalizeSlug(slug);

    const business = await this.businessModel
      .findOne({
        slug: normalizedSlug,
        isActive: true,
      })
      .select(
        '_id name slug logoUrl contactPhone publicEmail address description primaryColor secondaryColor businessType currency timezone domain isActive',
      )
      .lean();

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    return {
      id: String(business._id),
      name: business.name,
      slug: business.slug,
      logoUrl: business.logoUrl ?? null,
      contactPhone: business.contactPhone ?? null,
      whatsappUrl: this.buildWhatsappUrl(business.contactPhone),
      publicEmail: business.publicEmail ?? null,
      address: business.address ?? null,
      description: business.description ?? null,
      primaryColor: business.primaryColor ?? null,
      secondaryColor: business.secondaryColor ?? null,
      businessType: business.businessType ?? null,
      currency: business.currency ?? 'ARS',
      timezone: business.timezone ?? 'America/Argentina/Buenos_Aires',
      domain: business.domain ?? null,
      isActive: business.isActive,
    };
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

  private buildWhatsappUrl(contactPhone?: string | null) {
    if (!contactPhone) return null;

    const digits = contactPhone.replace(/\D/g, '');

    if (!digits) return null;

    return `https://wa.me/${digits}`;
  }

  private normalizeNullableString(value?: string | null) {
    if (value === null || value === undefined) return null;

    const trimmed = String(value).trim();

    return trimmed || null;
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