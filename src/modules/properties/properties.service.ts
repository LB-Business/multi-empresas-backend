import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
    Property,
    PropertyDocument,
} from './property.schema';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';

function slugify(value: string) {
    return value
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

function normalizeImages(images: any[] = []) {
    if (!Array.isArray(images)) return [];

    const hasCover = images.some((img) => img.isCover);

    return images
        .filter((img) => img?.url && img?.publicId)
        .map((img, index) => ({
            url: img.url,
            publicId: img.publicId,
            order: index,
            isCover: hasCover ? !!img.isCover : index === 0,
        }));
}

function normalizeDocuments(documents: any[] = []) {
    if (!Array.isArray(documents)) return [];

    return documents
        .filter((doc) => doc?.url && doc?.publicId)
        .map((doc) => ({
            label: doc.label?.trim() || 'Documento',
            type: doc.type?.trim() || 'otro',
            url: doc.url,
            publicId: doc.publicId,
            fileName: doc.fileName?.trim() || undefined,
            mimeType: doc.mimeType?.trim() || undefined,
            uploadedAt: doc.uploadedAt ? new Date(doc.uploadedAt) : new Date(),
        }));
}

@Injectable()
export class PropertiesService {
    constructor(
        @InjectModel(Property.name)
        private readonly propertyModel: Model<PropertyDocument>,
    ) { }

    async findAll(
        businessId: string,
        filters: {
            status?: string;
            operationType?: string;
            propertyType?: string;
            showOnLanding?: string;
            search?: string;
        },
    ) {
        const query: any = {
            businessId: new Types.ObjectId(businessId),
        };

        if (filters.status) query.status = filters.status;
        if (filters.operationType) query.operationType = filters.operationType;
        if (filters.propertyType) query.propertyType = filters.propertyType;

        if (filters.showOnLanding === 'true') query.showOnLanding = true;
        if (filters.showOnLanding === 'false') query.showOnLanding = false;

        if (filters.search?.trim()) {
            const regex = new RegExp(filters.search.trim(), 'i');

            query.$or = [
                { title: regex },
                { description: regex },
                { 'address.street': regex },
                { 'address.neighborhood': regex },
                { 'address.city': regex },
            ];
        }

        return this.propertyModel
            .find(query)
            .sort({ createdAt: -1 })
            .lean();
    }

    async findPublicByBusinessSlug(businessSlug: string) {
        return this.propertyModel
            .aggregate([
                {
                    $lookup: {
                        from: 'businesses',
                        localField: 'businessId',
                        foreignField: '_id',
                        as: 'business',
                    },
                },
                {
                    $unwind: '$business',
                },
                {
                    $match: {
                        'business.slug': businessSlug,
                        showOnLanding: true,
                        status: 'published',
                    },
                },
                {
                    $sort: {
                        createdAt: -1,
                    },
                },
                {
                    $project: {
                        internalNotes: 0,
                        documents: 0,
                        ml: 0,
                    },
                },
            ]);
    }

    async findPublicOneBySlug(businessSlug: string, propertySlug: string) {
        const result = await this.propertyModel.aggregate([
            {
                $lookup: {
                    from: 'businesses',
                    localField: 'businessId',
                    foreignField: '_id',
                    as: 'business',
                },
            },
            {
                $unwind: '$business',
            },
            {
                $match: {
                    'business.slug': businessSlug,
                    slug: propertySlug,
                    showOnLanding: true,
                    status: 'published',
                },
            },
            {
                $project: {
                    internalNotes: 0,
                    documents: 0,
                    ml: 0,
                },
            },
            {
                $limit: 1,
            },
        ]);

        if (!result.length) {
            throw new NotFoundException('Propiedad no encontrada');
        }

        return result[0];
    }

    async findOne(id: string, businessId: string) {
        if (!Types.ObjectId.isValid(id)) {
            throw new BadRequestException('ID inválido');
        }

        const property = await this.propertyModel
            .findOne({
                _id: new Types.ObjectId(id),
                businessId: new Types.ObjectId(businessId),
            })
            .lean();

        if (!property) {
            throw new NotFoundException('Propiedad no encontrada');
        }

        return property;
    }

    async create(
        dto: CreatePropertyDto,
        businessId: string,
        userId?: string,
    ) {
        const title = dto.title?.trim();

        if (!title) {
            throw new BadRequestException('El título es obligatorio');
        }

        const slug = slugify(dto.slug || title);

        if (!slug) {
            throw new BadRequestException('El slug es obligatorio');
        }

        const exists = await this.propertyModel.exists({
            businessId: new Types.ObjectId(businessId),
            slug,
        });

        if (exists) {
            throw new BadRequestException('Ya existe una propiedad con ese slug');
        }

        const created = await this.propertyModel.create({
            ...dto,
            businessId: new Types.ObjectId(businessId),
            title,
            slug,
            description: dto.description ?? '',
            operationType: dto.operationType ?? 'venta',
            propertyType: dto.propertyType ?? 'casa',
            status: dto.status ?? 'draft',
            showOnLanding: dto.showOnLanding ?? false,
            price: Number(dto.price ?? 0),
            currency: dto.currency ?? 'USD',
            expenses: Number(dto.expenses ?? 0),
            acceptsFinancing: dto.acceptsFinancing ?? false,
            acceptsExchange: dto.acceptsExchange ?? false,
            address: dto.address ?? {},
            features: dto.features ?? {},
            images: normalizeImages(dto.images),
            documents: normalizeDocuments(dto.documents),
            internalNotes: dto.internalNotes ?? '',
            createdBy: userId && Types.ObjectId.isValid(userId)
                ? new Types.ObjectId(userId)
                : undefined,
            updatedBy: userId && Types.ObjectId.isValid(userId)
                ? new Types.ObjectId(userId)
                : undefined,
        });

        return created.toObject();
    }

    async update(
        id: string,
        dto: UpdatePropertyDto,
        businessId: string,
        userId?: string,
    ) {
        if (!Types.ObjectId.isValid(id)) {
            throw new BadRequestException('ID inválido');
        }

        const current = await this.propertyModel.findOne({
            _id: new Types.ObjectId(id),
            businessId: new Types.ObjectId(businessId),
        });

        if (!current) {
            throw new NotFoundException('Propiedad no encontrada');
        }

        const nextTitle = dto.title?.trim() ?? current.title;
        const nextSlug = dto.slug
            ? slugify(dto.slug)
            : dto.title
                ? slugify(dto.title)
                : current.slug;

        if (!nextTitle) {
            throw new BadRequestException('El título es obligatorio');
        }

        if (!nextSlug) {
            throw new BadRequestException('El slug es obligatorio');
        }

        if (nextSlug !== current.slug) {
            const exists = await this.propertyModel.exists({
                _id: { $ne: current._id },
                businessId: new Types.ObjectId(businessId),
                slug: nextSlug,
            });

            if (exists) {
                throw new BadRequestException('Ya existe una propiedad con ese slug');
            }
        }

        const payload: any = {
            ...dto,
            title: nextTitle,
            slug: nextSlug,
            updatedBy: userId && Types.ObjectId.isValid(userId)
                ? new Types.ObjectId(userId)
                : undefined,
        };

        if (dto.images) {
            payload.images = normalizeImages(dto.images);
        }

        if (dto.documents) {
            payload.documents = normalizeDocuments(dto.documents);
        }

        if (dto.price !== undefined) payload.price = Number(dto.price ?? 0);
        if (dto.expenses !== undefined) payload.expenses = Number(dto.expenses ?? 0);

        const updated = await this.propertyModel
            .findOneAndUpdate(
                {
                    _id: new Types.ObjectId(id),
                    businessId: new Types.ObjectId(businessId),
                },
                {
                    $set: payload,
                },
                {
                    new: true,
                },
            )
            .lean();

        return updated;
    }

    async updateStatus(id: string, status: string, businessId: string) {
        if (
            !['draft', 'published', 'paused', 'sold', 'rented', 'archived'].includes(
                status,
            )
        ) {
            throw new BadRequestException('Estado inválido');
        }

        return this.propertyModel
            .findOneAndUpdate(
                {
                    _id: new Types.ObjectId(id),
                    businessId: new Types.ObjectId(businessId),
                },
                {
                    $set: {
                        status,
                    },
                },
                {
                    new: true,
                },
            )
            .lean();
    }

    async updateShowOnLanding(
        id: string,
        showOnLanding: boolean,
        businessId: string,
    ) {
        return this.propertyModel
            .findOneAndUpdate(
                {
                    _id: new Types.ObjectId(id),
                    businessId: new Types.ObjectId(businessId),
                },
                {
                    $set: {
                        showOnLanding,
                    },
                },
                {
                    new: true,
                },
            )
            .lean();
    }

    async remove(id: string, businessId: string) {
        const deleted = await this.propertyModel.findOneAndDelete({
            _id: new Types.ObjectId(id),
            businessId: new Types.ObjectId(businessId),
        });

        if (!deleted) {
            throw new NotFoundException('Propiedad no encontrada');
        }

        return {
            ok: true,
        };
    }

    async findPublicLandingByBusinessSlug(businessSlug: string) {
        const result = await this.propertyModel.aggregate([
            {
                $lookup: {
                    from: 'businesses',
                    localField: 'businessId',
                    foreignField: '_id',
                    as: 'business',
                },
            },
            {
                $unwind: '$business',
            },
            {
                $match: {
                    'business.slug': businessSlug,
                    'business.isActive': true,
                    showOnLanding: true,
                    status: 'published',
                },
            },
            {
                $sort: {
                    createdAt: -1,
                },
            },
            {
                $addFields: {
                    coverImage: {
                        $ifNull: [
                            {
                                $first: {
                                    $filter: {
                                        input: '$images',
                                        as: 'image',
                                        cond: { $eq: ['$$image.isCover', true] },
                                    },
                                },
                            },
                            { $first: '$images' },
                        ],
                    },
                },
            },
            {
                $project: {
                    _id: 1,
                    title: 1,
                    slug: 1,
                    description: 1,

                    operationType: 1,
                    propertyType: 1,
                    status: 1,

                    price: 1,
                    currency: 1,
                    expenses: 1,
                    acceptsFinancing: 1,
                    acceptsExchange: 1,

                    address: {
                        street: {
                            $cond: ['$address.showExactLocation', '$address.street', null],
                        },
                        number: {
                            $cond: ['$address.showExactLocation', '$address.number', null],
                        },
                        neighborhood: '$address.neighborhood',
                        city: '$address.city',
                        state: '$address.state',
                        country: '$address.country',
                        latitude: {
                            $cond: ['$address.showExactLocation', '$address.latitude', null],
                        },
                        longitude: {
                            $cond: ['$address.showExactLocation', '$address.longitude', null],
                        },
                        showExactLocation: '$address.showExactLocation',
                    },

                    features: 1,

                    images: {
                        $map: {
                            input: '$images',
                            as: 'image',
                            in: {
                                url: '$$image.url',
                                publicId: '$$image.publicId',
                                order: '$$image.order',
                                isCover: '$$image.isCover',
                            },
                        },
                    },

                    coverImage: {
                        url: '$coverImage.url',
                        publicId: '$coverImage.publicId',
                        order: '$coverImage.order',
                        isCover: '$coverImage.isCover',
                    },

                    createdAt: 1,
                    updatedAt: 1,

                    business: {
                        _id: '$business._id',
                        name: '$business.name',
                        slug: '$business.slug',
                        logoUrl: '$business.logoUrl',
                        contactPhone: '$business.contactPhone',
                        publicEmail: '$business.publicEmail',
                        address: '$business.address',
                        description: '$business.description',
                        domain: '$business.domain',
                        primaryColor: '$business.primaryColor',
                        secondaryColor: '$business.secondaryColor',
                        businessType: '$business.businessType',
                    },
                },
            },
        ]);

        const business = result[0]?.business ?? null;

        return {
            business,
            properties: result.map((property) => {
                const { business: _business, ...cleanProperty } = property;
                return cleanProperty;
            }),
        };
    }

    async findPublicLandingOneBySlug(
        businessSlug: string,
        propertySlug: string,
    ) {
        const result = await this.propertyModel.aggregate([
            {
                $lookup: {
                    from: 'businesses',
                    localField: 'businessId',
                    foreignField: '_id',
                    as: 'business',
                },
            },
            {
                $unwind: '$business',
            },
            {
                $match: {
                    'business.slug': businessSlug,
                    'business.isActive': true,
                    slug: propertySlug,
                    showOnLanding: true,
                    status: 'published',
                },
            },
            {
                $addFields: {
                    coverImage: {
                        $ifNull: [
                            {
                                $first: {
                                    $filter: {
                                        input: '$images',
                                        as: 'image',
                                        cond: { $eq: ['$$image.isCover', true] },
                                    },
                                },
                            },
                            { $first: '$images' },
                        ],
                    },
                },
            },
            {
                $project: {
                    _id: 1,
                    title: 1,
                    slug: 1,
                    description: 1,

                    operationType: 1,
                    propertyType: 1,
                    status: 1,

                    price: 1,
                    currency: 1,
                    expenses: 1,
                    acceptsFinancing: 1,
                    acceptsExchange: 1,

                    address: {
                        street: {
                            $cond: ['$address.showExactLocation', '$address.street', null],
                        },
                        number: {
                            $cond: ['$address.showExactLocation', '$address.number', null],
                        },
                        neighborhood: '$address.neighborhood',
                        city: '$address.city',
                        state: '$address.state',
                        country: '$address.country',
                        latitude: {
                            $cond: ['$address.showExactLocation', '$address.latitude', null],
                        },
                        longitude: {
                            $cond: ['$address.showExactLocation', '$address.longitude', null],
                        },
                        showExactLocation: '$address.showExactLocation',
                    },

                    features: 1,

                    images: {
                        $map: {
                            input: '$images',
                            as: 'image',
                            in: {
                                url: '$$image.url',
                                publicId: '$$image.publicId',
                                order: '$$image.order',
                                isCover: '$$image.isCover',
                            },
                        },
                    },

                    coverImage: {
                        url: '$coverImage.url',
                        publicId: '$coverImage.publicId',
                        order: '$coverImage.order',
                        isCover: '$coverImage.isCover',
                    },

                    createdAt: 1,
                    updatedAt: 1,

                    business: {
                        _id: '$business._id',
                        name: '$business.name',
                        slug: '$business.slug',
                        logoUrl: '$business.logoUrl',
                        contactPhone: '$business.contactPhone',
                        publicEmail: '$business.publicEmail',
                        address: '$business.address',
                        description: '$business.description',
                        domain: '$business.domain',
                        primaryColor: '$business.primaryColor',
                        secondaryColor: '$business.secondaryColor',
                        businessType: '$business.businessType',
                    },
                },
            },
            {
                $limit: 1,
            },
        ]);

        if (!result.length) {
            throw new NotFoundException('Propiedad no encontrada');
        }

        return result[0];
    }
}