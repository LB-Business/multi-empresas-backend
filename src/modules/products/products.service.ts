import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserRole } from '../../common/enums/user-role.enum';
import { ProductStatus } from '../../common/enums/product-status.enum';
import { ProductType } from '../../common/enums/product-type.enum';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { BusinessesService } from '../businesses/businesses.service';
import {
  CreateProductDto,
  ProductDocumentDto,
  ProductExtraExpenseItemDto,
  ProductImageDto,
  ProductOwnershipDto,
  ProductReservationDto,
  ProductVehicleDetailsDto,
  ProductVariantDto,
} from './dto/create-product.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import {
  Product,
  ProductDocument,
  ProductOwnershipType,
} from './schemas/product.schema';
import { MovementsService } from '../movements/movements.service';
import { v2 as cloudinary } from 'cloudinary';

type NormalizedExtraExpenseItem = {
  label: string;
  amount: number;
  expenseDate?: Date | null;
};

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly businessesService: BusinessesService,
    private readonly movementsService: MovementsService,
  ) { }

  async create(dto: CreateProductDto, currentUser: CurrentUser) {
    const businessId = this.toObjectId(currentUser.businessId, 'businessId');
    const status = dto.status ?? ProductStatus.DRAFT;
    const isPublished = this.resolvePublishedFlag(status, dto.isPublished);
    const slug = this.normalizeSlug(dto.slug ?? dto.name);
    const productType = dto.productType ?? ProductType.GENERAL;

    await this.ensureUniqueSlug(businessId, slug);

    const publishedAt =
      status === ProductStatus.PUBLISHED && isPublished ? new Date() : null;

    const soldAt =
      dto.soldAt !== undefined
        ? this.parseDateOrNull(dto.soldAt, 'soldAt')
        : status === ProductStatus.SOLD
          ? new Date()
          : null;

    const extraExpenseItems =
      this.resolveExtraExpenseItems(dto.extraExpenseItems, dto.extraExpenses) ??
      [];

    const normalizedVariants =
      productType === ProductType.ROPA
        ? this.normalizeVariants(dto.variants ?? [])
        : [];

    const resolvedStock = this.resolveStock({
      productType,
      stock: dto.stock,
      variants: normalizedVariants,
    });

    const product = await this.productModel.create({
      businessId,
      name: dto.name,
      slug,
      productType,
      description: dto.description ?? null,
      salePrice: dto.salePrice,
      currency: dto.currency,
      stock: resolvedStock,
      category: dto.category ?? null,
      tags: this.normalizeTags(dto.tags ?? []),
      images: this.normalizeImages(dto.images ?? []),
      documents: this.normalizeDocuments(dto.documents ?? []),
      variants: normalizedVariants,
      vehicleDetails:
        productType === ProductType.AUTO
          ? this.normalizeVehicleDetails(dto.vehicleDetails)
          : null,
      ownership:
        productType === ProductType.AUTO
          ? this.normalizeOwnership(dto.ownership)
          : this.emptyOwnership(),
      reservation: this.normalizeReservation(dto.reservation),
      status,
      isPublished,
      publishedAt,
      soldAt,
      finance:
        currentUser.role === UserRole.OWNER
          ? {
            costPrice: dto.costPrice ?? null,
            estimatedSalePrice: dto.estimatedSalePrice ?? null,
            finalSalePrice: dto.finalSalePrice ?? null,
            extraExpenseItems,
            internalNotes: dto.internalNotes ?? null,
          }
          : {
            costPrice: null,
            estimatedSalePrice: null,
            finalSalePrice: null,
            extraExpenseItems: [],
            internalNotes: null,
          },
      createdBy: this.toObjectId(currentUser.sub, 'userId'),
      updatedBy: this.toObjectId(currentUser.sub, 'userId'),
    });

    await this.movementsService.createMovement(
      {
        type: 'product_created',
        title: `Producto creado: ${product.name}`,
        description: product.description,
        meta: {
          productId: product.id,
          productType: product.productType,
          status: product.status,
          isPublished: product.isPublished,
        },
        amount: product.salePrice,
        direction: 'neutral',
        date: new Date(),
      },
      currentUser,
    );

    if (currentUser.role === UserRole.OWNER) {
      await this.registerProductExtraExpenseMovements({
        product,
        previousItems: [],
        nextItems: product.finance?.extraExpenseItems ?? [],
        currentUser,
      });
    }

    return this.serializeForRole(product, currentUser.role);
  }

  async findAllAdmin(currentUser: CurrentUser) {
    const products = await this.productModel
      .find({
        businessId: this.toObjectId(currentUser.businessId, 'businessId'),
      })
      .sort({ createdAt: -1 })
      .exec();

    return products.map((product) =>
      this.serializeForRole(product, currentUser.role),
    );
  }

  async findOneAdmin(id: string, currentUser: CurrentUser) {
    const product = await this.productModel.findOne({
      _id: this.toObjectId(id, 'productId'),
      businessId: this.toObjectId(currentUser.businessId, 'businessId'),
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.serializeForRole(product, currentUser.role);
  }

  async update(id: string, dto: UpdateProductDto, currentUser: CurrentUser) {
    const product = await this.productModel.findOne({
      _id: this.toObjectId(id, 'productId'),
      businessId: this.toObjectId(currentUser.businessId, 'businessId'),
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const oldName = product.name;
    const previousStatus = product.status;
    const previousIsPublished = product.isPublished;
    const previousStock = product.stock;

    const previousExtraExpenseItems = (
      product.finance?.extraExpenseItems ?? []
    ).map((item) => ({
      label: item.label ?? '',
      amount: item.amount ?? 0,
      expenseDate: item.expenseDate ?? null,
    }));

    if (dto.slug !== undefined || dto.name !== undefined) {
      const nextSlug = this.normalizeSlug(dto.slug ?? product.slug);
      if (nextSlug !== product.slug) {
        await this.ensureUniqueSlug(
          this.toObjectId(currentUser.businessId, 'businessId'),
          nextSlug,
          product.id,
        );
      }
      product.slug = nextSlug;
    }

    if (dto.name !== undefined) product.name = dto.name;
    if (dto.productType !== undefined) product.productType = dto.productType;
    if (dto.description !== undefined) {
      product.description = dto.description ?? null;
    }
    if (dto.salePrice !== undefined) product.salePrice = dto.salePrice;
    if (dto.currency !== undefined) product.currency = dto.currency;
    if (dto.category !== undefined) product.category = dto.category ?? null;
    if (dto.tags !== undefined) product.tags = this.normalizeTags(dto.tags);
    if (dto.images !== undefined) {
      product.images = this.normalizeImages(dto.images);
    }
    if (dto.documents !== undefined) {
      product.documents = this.normalizeDocuments(dto.documents);
    }

    const currentProductType = product.productType;

    if (currentProductType === ProductType.ROPA) {
      if (dto.variants !== undefined) {
        product.variants = this.normalizeVariants(dto.variants);
      }

      product.stock = this.resolveStock({
        productType: currentProductType,
        stock: dto.stock ?? product.stock,
        variants: product.variants ?? [],
      });

      if (product.stock <= 0 && product.status === ProductStatus.PUBLISHED) {
        product.status = ProductStatus.OUT_OF_STOCK;
        product.isPublished = false;
      }

      if (product.stock > 0 && product.status === ProductStatus.OUT_OF_STOCK) {
        product.status = ProductStatus.PUBLISHED;
        product.isPublished = true;
      }
    } else if (currentProductType === ProductType.AUTO) {
      product.variants = [];
      product.stock = 1;
    } else {
      product.variants = [];
      if (dto.stock !== undefined) {
        product.stock = dto.stock;
      }

      if (product.stock <= 0 && product.status === ProductStatus.PUBLISHED) {
        product.status = ProductStatus.OUT_OF_STOCK;
        product.isPublished = false;
      }

      if (product.stock > 0 && product.status === ProductStatus.OUT_OF_STOCK) {
        product.status = ProductStatus.PUBLISHED;
        product.isPublished = true;
      }
    }

    const nextStatus = dto.status ?? product.status;
    const nextIsPublished = this.resolvePublishedFlag(
      nextStatus,
      dto.isPublished ?? product.isPublished,
    );

    product.status = nextStatus;
    product.isPublished = nextIsPublished;

    if (
      nextStatus === ProductStatus.PUBLISHED &&
      nextIsPublished &&
      !product.publishedAt
    ) {
      product.publishedAt = new Date();
    }

    if (dto.soldAt !== undefined) {
      product.soldAt = this.parseDateOrNull(dto.soldAt, 'soldAt');
    } else if (dto.status !== undefined) {
      if (nextStatus === ProductStatus.SOLD && !product.soldAt) {
        product.soldAt = new Date();
      } else if (nextStatus !== ProductStatus.SOLD) {
        product.soldAt = null;
      }
    }

    if (product.productType === ProductType.AUTO) {
      if (dto.vehicleDetails !== undefined) {
        product.vehicleDetails = this.mergeVehicleDetails(
          product.vehicleDetails ?? null,
          dto.vehicleDetails,
        );
      }

      if (dto.ownership !== undefined) {
        product.ownership = this.mergeOwnership(
          product.ownership ?? this.emptyOwnership(),
          dto.ownership,
        );
      }
    } else {
      product.vehicleDetails = null;
      product.ownership = this.emptyOwnership();
    }

    if (dto.reservation !== undefined) {
      product.reservation = this.mergeReservation(
        product.reservation,
        dto.reservation,
      );
    }

    if (currentUser.role === UserRole.OWNER) {
      if (dto.costPrice !== undefined) {
        product.finance.costPrice = dto.costPrice;
      }
      if (dto.estimatedSalePrice !== undefined) {
        product.finance.estimatedSalePrice = dto.estimatedSalePrice;
      }
      if (dto.finalSalePrice !== undefined) {
        product.finance.finalSalePrice = dto.finalSalePrice;
      }
      if (
        dto.extraExpenseItems !== undefined ||
        dto.extraExpenses !== undefined
      ) {
        product.finance.extraExpenseItems =
          this.resolveExtraExpenseItems(
            dto.extraExpenseItems,
            dto.extraExpenses,
          ) ?? [];
      }
      if (dto.internalNotes !== undefined) {
        product.finance.internalNotes = dto.internalNotes;
      }
    }

    product.updatedBy = this.toObjectId(currentUser.sub, 'userId');
    await product.save();

    await this.movementsService.createMovement(
      {
        type: 'product_updated',
        title: `Producto actualizado: ${oldName}`,
        description: product.description,
        meta: {
          productId: product.id,
          previousStatus,
          nextStatus: product.status,
          previousIsPublished,
          nextIsPublished: product.isPublished,
          previousStock,
          nextStock: product.stock,
        },
        amount: product.salePrice,
        direction: 'neutral',
        date: new Date(),
      },
      currentUser,
    );

    if (
      previousStock !== product.stock ||
      previousStatus !== product.status ||
      previousIsPublished !== product.isPublished
    ) {
      await this.movementsService.createMovement(
        {
          type: 'product_inventory_updated',
          title: `Inventario actualizado: ${product.name}`,
          description: `Stock ${previousStock} → ${product.stock}`,
          meta: {
            productId: product.id,
            previousStock,
            nextStock: product.stock,
            previousStatus,
            nextStatus: product.status,
            previousIsPublished,
            nextIsPublished: product.isPublished,
          },
          amount: product.salePrice,
          direction: 'neutral',
          date: new Date(),
        },
        currentUser,
      );
    }

    if (currentUser.role === UserRole.OWNER) {
      await this.registerProductExtraExpenseMovements({
        product,
        previousItems: previousExtraExpenseItems,
        nextItems: product.finance?.extraExpenseItems ?? [],
        currentUser,
      });
    }

    return this.serializeForRole(product, currentUser.role);
  }

async updateStatus(
  id: string,
  dto: UpdateProductStatusDto,
  currentUser: CurrentUser,
) {
  const product = await this.productModel.findOne({
    _id: this.toObjectId(id, 'productId'),
    businessId: this.toObjectId(currentUser.businessId, 'businessId'),
  });

  if (!product) {
    throw new NotFoundException('Product not found');
  }

  const oldStatus = product.status;

  const previousReservation = {
    depositAmount: product.reservation?.depositAmount ?? null,
    depositCurrency: product.reservation?.depositCurrency ?? null,
    depositDate: product.reservation?.depositDate ?? null,
    customerName: product.reservation?.customerName ?? null,
    customerPhone: product.reservation?.customerPhone ?? null,
    notes: product.reservation?.notes ?? null,
  };

  const previousDepositAmount = Number(previousReservation.depositAmount ?? 0);

  if (!product.finance) {
    product.finance = {} as any;
  }

  const isVariantSale =
    dto.status === ProductStatus.SOLD &&
    dto.variantIndex !== undefined &&
    this.hasVariants(product);

  if (isVariantSale) {
    const variantIndex = dto.variantIndex;

    if (variantIndex === undefined) {
      throw new BadRequestException('Variante inválida');
    }

    const quantity = dto.quantity ?? 1;

    const movementDate =
      dto.soldAt !== undefined
        ? (this.parseDateOrNull(dto.soldAt, 'soldAt') ?? new Date())
        : new Date();

    const soldVariant = this.sellVariantUnits({
      product,
      variantIndex,
      quantity,
      movementDate,
    });

    if (dto.finalSalePrice !== undefined) {
      product.finance.finalSalePrice = dto.finalSalePrice;
    }

    if (dto.clearReservation) {
      product.reservation = this.emptyReservation();
    }

    product.updatedBy = this.toObjectId(currentUser.sub, 'userId');

    await product.save();

    const unitPrice = Number(
      dto.finalSalePrice ?? soldVariant?.salePrice ?? product.salePrice ?? 0,
    );

    await this.movementsService.createMovement(
      {
        type: 'product_sold',
        title: `Venta de variante: ${product.name}`,
        description: `${this.getVariantLabel(
          soldVariant,
          variantIndex,
        )} x${quantity}`,
        meta: {
          productId: product.id,
          sourceId: product.id,
          currency: product.currency,
          previousStatus: oldStatus,
          nextStatus: product.status,
          variantIndex,
          quantity,
          variant: {
            size: soldVariant?.size ?? null,
            color: soldVariant?.color ?? null,
            sku: soldVariant?.sku ?? null,
          },
          remainingProductStock: product.stock,
          clearedReservation: dto.clearReservation === true,
        },
        amount: unitPrice * quantity,
        direction: 'in',
        date: movementDate,
      },
      currentUser,
    );

    return this.serializeForRole(product, currentUser.role);
  }

  const nextStatus = dto.status;

  const nextIsPublished = this.resolvePublishedFlag(
    nextStatus,
    dto.isPublished ?? product.isPublished,
  );

  product.status = nextStatus;
  product.isPublished = nextIsPublished;
  product.updatedBy = this.toObjectId(currentUser.sub, 'userId');

  if (nextStatus === ProductStatus.PUBLISHED && nextIsPublished) {
    product.publishedAt = product.publishedAt ?? new Date();
  }

  if (nextStatus === ProductStatus.SOLD) {
    product.soldAt =
      dto.soldAt !== undefined
        ? this.parseDateOrNull(dto.soldAt, 'soldAt')
        : product.soldAt ?? new Date();
  } else {
    product.soldAt = null;
  }

  if (dto.clearReservation) {
    product.reservation = this.emptyReservation();
  } else if (dto.reservation !== undefined) {
    product.reservation = this.mergeReservation(
      product.reservation,
      dto.reservation,
    );
  }

  if (dto.finalSalePrice !== undefined) {
    product.finance.finalSalePrice = dto.finalSalePrice;
  }

  await product.save();

  const nextDepositAmount = Number(product.reservation?.depositAmount ?? 0);

  const isDepositRefund =
    dto.clearReservation === true &&
    nextStatus === ProductStatus.PUBLISHED &&
    previousDepositAmount > 0;

  const isDepositReceived =
    nextStatus === ProductStatus.RESERVED &&
    oldStatus !== ProductStatus.RESERVED &&
    nextDepositAmount > 0;

  let movementType = 'product_status_updated';
  let movementTitle = `Cambio de estado de producto: ${product.name}`;
  let movementDescription = `De: ${oldStatus} a: ${nextStatus}`;
  let movementAmount = Number(product.salePrice ?? 0);
  let movementDirection: 'in' | 'out' | 'neutral' = 'neutral';
  let movementDate = new Date();
  let movementCurrency = product.currency ?? 'ARS';

  if (nextStatus === ProductStatus.SOLD) {
    movementType = 'product_sold';
    movementTitle = `Producto vendido: ${product.name}`;
    movementDescription = `Venta registrada`;
    movementAmount = Number(
      dto.finalSalePrice ??
        product.finance?.finalSalePrice ??
        product.salePrice ??
        0,
    );
    movementDirection = 'in';
    movementDate = product.soldAt ?? new Date();
    movementCurrency = product.currency ?? 'ARS';
  }

  if (isDepositReceived) {
    movementType = 'deposit_received';
    movementTitle = `Seña recibida: ${product.name}`;
    movementDescription = product.reservation?.customerName
      ? `Cliente: ${product.reservation.customerName}`
      : `Producto señado`;
    movementAmount = nextDepositAmount;
    movementDirection = 'in';
    movementDate = product.reservation?.depositDate ?? new Date();
    movementCurrency =
      product.reservation?.depositCurrency ?? product.currency ?? 'ARS';
  }

  if (isDepositRefund) {
    movementType = 'deposit_refunded';
    movementTitle = `Seña devuelta: ${product.name}`;
    movementDescription = previousReservation.customerName
      ? `Cliente: ${previousReservation.customerName}`
      : `Se devolvió la seña y el producto volvió a publicado`;
    movementAmount = previousDepositAmount;
    movementDirection = 'out';
    movementDate = new Date();
    movementCurrency =
      previousReservation.depositCurrency ?? product.currency ?? 'ARS';
  }

  await this.movementsService.createMovement(
    {
      type: movementType,
      title: movementTitle,
      description: movementDescription,
      meta: {
        productId: product.id,
        sourceId: product.id,
        currency: movementCurrency,
        previousStatus: oldStatus,
        nextStatus: product.status,
        previousReservation,
        clearReservation: dto.clearReservation === true,
      },
      amount: movementAmount,
      direction: movementDirection,
      date: movementDate,
    },
    currentUser,
  );

  return this.serializeForRole(product, currentUser.role);
}

  async remove(id: string, currentUser: CurrentUser) {
    const product = await this.productModel.findOne({
      _id: this.toObjectId(id, 'productId'),
      businessId: this.toObjectId(currentUser.businessId, 'businessId'),
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const currentExtraExpenseItems = (
      product.finance?.extraExpenseItems ?? []
    ).map((item) => ({
      label: item.label ?? '',
      amount: item.amount ?? 0,
      expenseDate: item.expenseDate ?? null,
    }));

    if (currentExtraExpenseItems.length > 0 && currentUser.role === UserRole.OWNER) {
      await this.registerProductExtraExpenseMovements({
        product,
        previousItems: currentExtraExpenseItems,
        nextItems: [],
        currentUser,
      });
    }

    if (product.images && product.images.length > 0) {
      for (const image of product.images) {
        if (image.publicId) {
          try {
            await cloudinary.uploader.destroy(image.publicId);
          } catch (err) {
            console.warn(`No se pudo eliminar la imagen ${image.publicId}`, err);
          }
        }
      }
    }

    if (product.documents && product.documents.length > 0) {
      for (const document of product.documents) {
        if (document.publicId) {
          try {
            await cloudinary.uploader.destroy(document.publicId, {
              resource_type: 'raw',
            });
          } catch (err) {
            console.warn(
              `No se pudo eliminar el documento ${document.publicId}`,
              err,
            );
          }
        }
      }
    }

    await this.productModel.deleteOne({ _id: product._id }).exec();

    await this.movementsService.createMovement(
      {
        type: 'product_deleted',
        title: `Producto eliminado: ${product.name}`,
        description: product.description,
        meta: { productId: product.id },
        amount: product.salePrice,
        direction: 'out',
        date: new Date(),
      },
      currentUser,
    );

    return { message: 'Product deleted successfully' };
  }

  async findPublicProductsBySlug(slug: string) {
    const business = await this.businessesService.findBySlug(slug);
    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const businessObjectId = this.toObjectId(
      String((business as any)._id),
      'businessId',
    );

    const products = await this.productModel
      .find({
        businessId: businessObjectId,
        isPublished: true,
        status: ProductStatus.PUBLISHED,
      })
      .sort({ createdAt: -1 })
      .exec();

    return {
      business: {
        id: (business as any).id,
        name: (business as any).name,
        slug: (business as any).slug,
        logoUrl: (business as any).logoUrl ?? null,
        contactPhone:
          (business as any).contactPhone ?? (business as any).whatsapp ?? null,
        publicEmail: (business as any).publicEmail ?? null,
      },
      products: products.map((product) => this.serializePublic(product)),

    };
  }

  async findPublicProductBySlug(slug: string, productId: string) {
    const business = await this.businessesService.findBySlug(slug);
    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const businessObjectId = this.toObjectId(
      String((business as any)._id),
      'businessId',
    );

    const product = await this.productModel.findOne({
      _id: this.toObjectId(productId, 'productId'),
      businessId: businessObjectId,
      isPublished: true,
      status: ProductStatus.PUBLISHED,
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return {
      business: {
        id: (business as any).id,
        name: (business as any).name,
        slug: (business as any).slug,
        logoUrl: (business as any).logoUrl ?? null,
        contactPhone:
          (business as any).contactPhone ?? (business as any).whatsapp ?? null,
        publicEmail: (business as any).publicEmail ?? null,
      },
      product: this.serializePublic(product),
    };
  }

  private async ensureUniqueSlug(
    businessId: Types.ObjectId,
    slug: string,
    ignoreProductId?: string,
  ) {
    const existing = await this.productModel.findOne({ businessId, slug }).exec();

    if (existing && existing.id !== ignoreProductId) {
      throw new ConflictException('Product slug already in use');
    }
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
      throw new BadRequestException('Invalid slug');
    }

    return slug;
  }

  private normalizeTags(tags: string[] = []) {
    return Array.from(
      new Set(
        tags
          .map((tag) => tag.trim())
          .filter(Boolean),
      ),
    );
  }

  private toObjectId(value: string, fieldName = 'id') {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException(`Invalid ${fieldName}`);
    }

    return new Types.ObjectId(value);
  }

  private parseDateOrNull(
    value: string | null | undefined,
    fieldName: string,
  ): Date | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid ${fieldName}`);
    }

    return parsed;
  }

  private resolvePublishedFlag(
    status: ProductStatus,
    requested?: boolean,
  ): boolean {
    if (status === ProductStatus.PUBLISHED) {
      return requested ?? true;
    }

    return false;
  }

  private normalizeImages(images: ProductImageDto[] = []) {
    if (!images.length) {
      return [];
    }

    const sorted = images
      .map((image, index) => ({
        url: image.url,
        publicId: image.publicId,
        order: image.order ?? index,
        isCover: image.isCover ?? false,
      }))
      .sort((a, b) => a.order - b.order);

    const firstRequestedCoverIndex = sorted.findIndex((image) => image.isCover);
    const coverIndex =
      firstRequestedCoverIndex >= 0 ? firstRequestedCoverIndex : 0;

    return sorted.map((image, index) => ({
      url: image.url,
      publicId: image.publicId,
      order: index,
      isCover: index === coverIndex,
    }));
  }

  private normalizeVariants(variants: ProductVariantDto[] = []) {
    return variants
      .map((variant) => ({
        size: variant.size?.trim() || null,
        color: variant.color?.trim() || null,
        sku: variant.sku?.trim() || null,
        salePrice: variant.salePrice ?? null,
        stock: Number(variant.stock ?? 0),
      }))
      .filter(
        (variant) =>
          variant.stock >= 0 &&
          !!(
            variant.size ||
            variant.color ||
            variant.sku ||
            variant.salePrice != null
          ),
      );
  }

  private resolveStock(params: {
    productType: ProductType;
    stock?: number | null;
    variants?: Array<{ stock: number }>;
  }) {
    if (params.productType === ProductType.AUTO) {
      return 1;
    }

    if (params.productType === ProductType.ROPA) {
      return (params.variants ?? []).reduce(
        (acc, variant) => acc + Number(variant.stock ?? 0),
        0,
      );
    }

    return Number(params.stock ?? 0);
  }

  private hasVariants(product: ProductDocument) {
    return Array.isArray(product.variants) && product.variants.length > 0;
  }

  private sellVariantUnits(params: {
    product: ProductDocument;
    variantIndex: number;
    quantity: number;
    movementDate: Date;
  }) {
    const { product, variantIndex, quantity, movementDate } = params;

    if (!this.hasVariants(product)) {
      throw new BadRequestException(
        'Este producto no tiene variantes para vender por unidad',
      );
    }

    if (variantIndex < 0 || variantIndex >= (product.variants?.length ?? 0)) {
      throw new BadRequestException('Variante inválida');
    }

    const variant = product.variants[variantIndex];

    if (!variant) {
      throw new BadRequestException('Variante inválida');
    }

    const currentStock = Number(variant.stock ?? 0);

    if (quantity <= 0) {
      throw new BadRequestException('La cantidad debe ser mayor a 0');
    }

    if (currentStock < quantity) {
      throw new BadRequestException(
        'No hay stock suficiente en la variante seleccionada',
      );
    }

    variant.stock = currentStock - quantity;

    product.stock = this.resolveStock({
      productType: product.productType,
      variants: product.variants ?? [],
      stock: product.stock,
    });

    if (product.stock <= 0) {
      product.status = ProductStatus.OUT_OF_STOCK;
      product.isPublished = false;
      product.soldAt = movementDate;
    } else {
      product.status = ProductStatus.PUBLISHED;
      product.isPublished = true;
      product.soldAt = null;
    }

    return variant;
  }

  private getVariantLabel(variant: any, index: number) {
    const parts = [variant?.size, variant?.color, variant?.sku].filter(Boolean);
    return parts.length ? parts.join(' / ') : `Variante #${index + 1}`;
  }

  private normalizeVehicleDetails(input?: ProductVehicleDetailsDto | null) {
    const normalized = {
      brand: input?.brand?.trim() || null,
      model: input?.model?.trim() || null,
      version: input?.version?.trim() || null,
      year: input?.year ?? null,
      kms: input?.kms ?? null,
      fuelType: input?.fuelType?.trim() || null,
      transmission: input?.transmission?.trim() || null,
      color: input?.color?.trim() || null,
      plate: input?.plate?.trim() || null,
    };

    const hasAnyValue = Object.values(normalized).some(
      (value) => value !== null && value !== '',
    );

    return hasAnyValue ? normalized : null;
  }

  private mergeVehicleDetails(
    existing: any,
    input?: ProductVehicleDetailsDto | null,
  ) {
    const merged = {
      brand:
        input?.brand !== undefined
          ? input.brand?.trim() || null
          : existing?.brand ?? null,
      model:
        input?.model !== undefined
          ? input.model?.trim() || null
          : existing?.model ?? null,
      version:
        input?.version !== undefined
          ? input.version?.trim() || null
          : existing?.version ?? null,
      year:
        input?.year !== undefined ? input.year ?? null : existing?.year ?? null,
      kms: input?.kms !== undefined ? input.kms ?? null : existing?.kms ?? null,
      fuelType:
        input?.fuelType !== undefined
          ? input.fuelType?.trim() || null
          : existing?.fuelType ?? null,
      transmission:
        input?.transmission !== undefined
          ? input.transmission?.trim() || null
          : existing?.transmission ?? null,
      color:
        input?.color !== undefined
          ? input.color?.trim() || null
          : existing?.color ?? null,
      plate:
        input?.plate !== undefined
          ? input.plate?.trim() || null
          : existing?.plate ?? null,
    };

    const hasAnyValue = Object.values(merged).some(
      (value) => value !== null && value !== '',
    );

    return hasAnyValue ? merged : null;
  }

  private normalizeOwnership(input?: ProductOwnershipDto | null) {
    const ownershipType = input?.ownershipType ?? ProductOwnershipType.OWNED;

    return {
      ownershipType,
      purchasePrice:
        ownershipType === ProductOwnershipType.OWNED
          ? input?.purchasePrice ?? null
          : null,
      purchaseDate:
        ownershipType === ProductOwnershipType.OWNED
          ? input?.purchaseDate !== undefined
            ? this.parseDateOrNull(input.purchaseDate, 'ownership.purchaseDate')
            : null
          : null,
      ownerExpectedAmount:
        ownershipType === ProductOwnershipType.CONSIGNMENT
          ? input?.ownerExpectedAmount ?? null
          : null,
      consignorName:
        ownershipType === ProductOwnershipType.CONSIGNMENT
          ? input?.consignorName?.trim() || null
          : null,
      consignorPhone:
        ownershipType === ProductOwnershipType.CONSIGNMENT
          ? input?.consignorPhone?.trim() || null
          : null,
    };
  }

  private mergeOwnership(existing: any, input?: ProductOwnershipDto | null) {
    const nextOwnershipType =
      input?.ownershipType ??
      existing?.ownershipType ??
      ProductOwnershipType.OWNED;

    return {
      ownershipType: nextOwnershipType,
      purchasePrice:
        nextOwnershipType === ProductOwnershipType.OWNED
          ? input?.purchasePrice !== undefined
            ? input.purchasePrice
            : existing?.purchasePrice ?? null
          : null,
      purchaseDate:
        nextOwnershipType === ProductOwnershipType.OWNED
          ? input?.purchaseDate !== undefined
            ? this.parseDateOrNull(input.purchaseDate, 'ownership.purchaseDate')
            : existing?.purchaseDate ?? null
          : null,
      ownerExpectedAmount:
        nextOwnershipType === ProductOwnershipType.CONSIGNMENT
          ? input?.ownerExpectedAmount !== undefined
            ? input.ownerExpectedAmount
            : existing?.ownerExpectedAmount ?? null
          : null,
      consignorName:
        nextOwnershipType === ProductOwnershipType.CONSIGNMENT
          ? input?.consignorName !== undefined
            ? input.consignorName?.trim() || null
            : existing?.consignorName ?? null
          : null,
      consignorPhone:
        nextOwnershipType === ProductOwnershipType.CONSIGNMENT
          ? input?.consignorPhone !== undefined
            ? input.consignorPhone?.trim() || null
            : existing?.consignorPhone ?? null
          : null,
    };
  }

  private emptyOwnership() {
    return {
      ownershipType: ProductOwnershipType.OWNED,
      purchasePrice: null,
      purchaseDate: null,
      ownerExpectedAmount: null,
      consignorName: null,
      consignorPhone: null,
    };
  }

  private normalizeReservation(input?: ProductReservationDto) {
    return {
      depositAmount: input?.depositAmount ?? null,
      depositCurrency: input?.depositCurrency ?? null,
      depositDate:
        input?.depositDate !== undefined
          ? this.parseDateOrNull(input.depositDate, 'reservation.depositDate')
          : null,
      customerName: input?.customerName?.trim() || null,
      customerPhone: input?.customerPhone?.trim() || null,
      notes: input?.notes?.trim() || null,
    };
  }

  private mergeReservation(existing: any, input?: ProductReservationDto | null) {
    return {
      depositAmount:
        input?.depositAmount !== undefined
          ? input.depositAmount
          : existing?.depositAmount ?? null,
      depositCurrency:
        input?.depositCurrency !== undefined
          ? input.depositCurrency
          : existing?.depositCurrency ?? null,
      depositDate:
        input?.depositDate !== undefined
          ? this.parseDateOrNull(input.depositDate, 'reservation.depositDate')
          : existing?.depositDate ?? null,
      customerName:
        input?.customerName !== undefined
          ? input.customerName?.trim() || null
          : existing?.customerName ?? null,
      customerPhone:
        input?.customerPhone !== undefined
          ? input.customerPhone?.trim() || null
          : existing?.customerPhone ?? null,
      notes:
        input?.notes !== undefined
          ? input.notes?.trim() || null
          : existing?.notes ?? null,
    };
  }

  private emptyReservation() {
    return {
      depositAmount: null,
      depositCurrency: null,
      depositDate: null,
      customerName: null,
      customerPhone: null,
      notes: null,
    };
  }

  private normalizeExtraExpenseItems(
    items: ProductExtraExpenseItemDto[] = [],
  ) {
    return items
      .map((item) => ({
        label: item.label.trim(),
        amount: item.amount,
        expenseDate:
          item.expenseDate !== undefined
            ? this.parseDateOrNull(
              item.expenseDate,
              'extraExpenseItems.expenseDate',
            )
            : null,
      }))
      .filter((item) => item.label && item.amount >= 0);
  }

  private resolveExtraExpenseItems(
    items?: ProductExtraExpenseItemDto[],
    legacyExtraExpenses?: number,
  ) {
    if (items !== undefined) {
      return this.normalizeExtraExpenseItems(items);
    }

    if (legacyExtraExpenses !== undefined) {
      if (legacyExtraExpenses <= 0) {
        return [];
      }

      return [
        {
          label: 'Gasto extra',
          amount: legacyExtraExpenses,
          expenseDate: null,
        },
      ];
    }

    return undefined;
  }

  private sumExtraExpenseItems(
    items: Array<{ label: string; amount: number; expenseDate?: Date | null }> =
      [],
  ) {
    return items.reduce((acc, item) => acc + (item.amount ?? 0), 0);
  }

  private areDatesEqual(a?: Date | null, b?: Date | null) {
    const aTime = a ? new Date(a).getTime() : null;
    const bTime = b ? new Date(b).getTime() : null;
    return aTime === bTime;
  }

  private areExtraExpenseItemsEqual(
    a?: NormalizedExtraExpenseItem,
    b?: NormalizedExtraExpenseItem,
  ) {
    if (!a || !b) return false;

    return (
      (a.label ?? '') === (b.label ?? '') &&
      Number(a.amount ?? 0) === Number(b.amount ?? 0) &&
      this.areDatesEqual(a.expenseDate ?? null, b.expenseDate ?? null)
    );
  }

  private async registerProductExtraExpenseMovements(params: {
    product: ProductDocument;
    previousItems: NormalizedExtraExpenseItem[];
    nextItems: NormalizedExtraExpenseItem[];
    currentUser: CurrentUser;
  }) {
    const { product, previousItems, nextItems, currentUser } = params;

    const maxLength = Math.max(previousItems.length, nextItems.length);

    for (let index = 0; index < maxLength; index++) {
      const previous = previousItems[index];
      const next = nextItems[index];

      if (!previous && next) {
        await this.movementsService.createMovement(
          {
            type: 'product_extra_expense_created',
            title: `Gasto extra agregado a producto: ${product.name}`,
            description: next.label,
            meta: {
              productId: product.id,
              label: next.label,
              amount: next.amount,
              expenseDate: next.expenseDate ?? null,
              index,
            },
            amount: next.amount,
            direction: 'out',
            date: next.expenseDate ?? new Date(),
          },
          currentUser,
        );
        continue;
      }

      if (previous && !next) {
        await this.movementsService.createMovement(
          {
            type: 'product_extra_expense_deleted',
            title: `Gasto extra eliminado de producto: ${product.name}`,
            description: previous.label,
            meta: {
              productId: product.id,
              label: previous.label,
              amount: previous.amount,
              expenseDate: previous.expenseDate ?? null,
              index,
            },
            amount: previous.amount,
            direction: 'neutral',
            date: new Date(),
          },
          currentUser,
        );
        continue;
      }

      if (previous && next && !this.areExtraExpenseItemsEqual(previous, next)) {
        await this.movementsService.createMovement(
          {
            type: 'product_extra_expense_updated',
            title: `Gasto extra actualizado en producto: ${product.name}`,
            description: next.label,
            meta: {
              productId: product.id,
              index,
              previous,
              next,
            },
            amount: next.amount,
            direction: 'neutral',
            date: next.expenseDate ?? new Date(),
          },
          currentUser,
        );
      }
    }
  }

  private serializeImage(image: {
    url: string;
    publicId: string;
    order?: number;
    isCover?: boolean;
  }) {
    return {
      url: image.url,
      publicId: image.publicId,
      order: image.order ?? 0,
      isCover: image.isCover ?? false,
    };
  }

  private serializeVariant(variant: any) {
    return {
      size: variant?.size ?? null,
      color: variant?.color ?? null,
      sku: variant?.sku ?? null,
      salePrice: variant?.salePrice ?? null,
      stock: variant?.stock ?? 0,
    };
  }

  private serializeVehicleDetails(vehicleDetails: any) {
    if (!vehicleDetails) return null;

    return {
      brand: vehicleDetails.brand ?? null,
      model: vehicleDetails.model ?? null,
      version: vehicleDetails.version ?? null,
      year: vehicleDetails.year ?? null,
      kms: vehicleDetails.kms ?? null,
      fuelType: vehicleDetails.fuelType ?? null,
      transmission: vehicleDetails.transmission ?? null,
      color: vehicleDetails.color ?? null,
      plate: vehicleDetails.plate ?? null,
    };
  }

  private serializeOwnership(ownership: any) {
    if (!ownership) {
      return this.emptyOwnership();
    }

    return {
      ownershipType: ownership.ownershipType ?? ProductOwnershipType.OWNED,
      purchasePrice: ownership.purchasePrice ?? null,
      purchaseDate: ownership.purchaseDate ?? null,
      ownerExpectedAmount: ownership.ownerExpectedAmount ?? null,
      consignorName: ownership.consignorName ?? null,
      consignorPhone: ownership.consignorPhone ?? null,
    };
  }

  private serializeReservation(reservation: any) {
    const depositAmount = reservation?.depositAmount ?? null;
    const depositCurrency = reservation?.depositCurrency ?? null;
    const depositDate = reservation?.depositDate ?? null;
    const customerName = reservation?.customerName ?? null;
    const customerPhone = reservation?.customerPhone ?? null;
    const notes = reservation?.notes ?? null;

    const hasReservationData =
      depositAmount != null ||
      depositCurrency != null ||
      depositDate != null ||
      customerName != null ||
      customerPhone != null ||
      notes != null;

    if (!hasReservationData) {
      return null;
    }

    return {
      depositAmount,
      depositCurrency,
      depositDate,
      customerName,
      customerPhone,
      notes,
    };
  }

  private serializeExtraExpenseItem(item: any) {
    return {
      label: item?.label ?? '',
      amount: item?.amount ?? 0,
      expenseDate: item?.expenseDate ?? null,
    };
  }

  private serializePublic(product: ProductDocument) {
    const images = (product.images ?? [])
      .map((image) => this.serializeImage(image))
      .sort((a, b) => a.order - b.order);

    const coverImage =
      images.find((image) => image.isCover) ?? images[0] ?? null;

    const variants = (product.variants ?? []).map((variant) =>
      this.serializeVariant(variant),
    );

    return {
      id: product.id,
      businessId: product.businessId.toString(),
      name: product.name,
      slug: product.slug,
      productType: product.productType,
      description: product.description ?? null,
      salePrice: product.salePrice,
      currency: product.currency,
      stock: product.stock,
      category: product.category ?? null,
      tags: product.tags ?? [],
      coverImage,
      images,
      variants,
      documents: [],
      vehicleDetails: this.serializeVehicleDetails(product.vehicleDetails),
      ownership: this.serializeOwnership(product.ownership),
      status: product.status,
      isPublished: product.isPublished,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,

    };
  }

  private serializeForRole(product: ProductDocument, role: UserRole) {
    const base = this.serializePublic(product);

    const adminExtras = {
      publishedAt: product.publishedAt ?? null,
      soldAt: product.soldAt ?? null,
      reservation: this.serializeReservation(product.reservation),
      documents: (product.documents ?? []).map((document) =>
        this.serializeDocument(document),
      ),
    };

    if (role !== UserRole.OWNER) {
      return {
        ...base,
        ...adminExtras,
      };
    }

    const costPrice = product.finance?.costPrice ?? null;
    const estimatedSalePrice = product.finance?.estimatedSalePrice ?? null;
    const finalSalePrice = product.finance?.finalSalePrice ?? null;

    const extraExpenseItems = (product.finance?.extraExpenseItems ?? []).map(
      (item) => this.serializeExtraExpenseItem(item),
    );

    const extraExpensesTotal = this.sumExtraExpenseItems(extraExpenseItems);

    const ownershipType =
      base.ownership.ownershipType ?? ProductOwnershipType.OWNED;

    const ownerExpectedAmount = base.ownership.ownerExpectedAmount ?? 0;

    const baseCost =
      ownershipType === ProductOwnershipType.CONSIGNMENT
        ? ownerExpectedAmount
        : costPrice ?? 0;

    const saleCurrency = base.currency === 'USD' ? 'USD' : 'ARS';

    const estimatedSale =
      estimatedSalePrice ?? base.salePrice ?? 0;

    const estimatedProfitByCurrency = {
      ARS: 0,
      USD: 0,
    };

    const realProfitByCurrency = {
      ARS: 0,
      USD: 0,
    };

    if (saleCurrency === 'USD') {
      estimatedProfitByCurrency.USD = estimatedSale - baseCost;
      estimatedProfitByCurrency.ARS = -extraExpensesTotal;

      if (finalSalePrice != null && finalSalePrice > 0) {
        realProfitByCurrency.USD = finalSalePrice - baseCost;
        realProfitByCurrency.ARS = -extraExpensesTotal;
      }
    } else {
      estimatedProfitByCurrency.ARS =
        estimatedSale - baseCost - extraExpensesTotal;

      if (finalSalePrice != null && finalSalePrice > 0) {
        realProfitByCurrency.ARS =
          finalSalePrice - baseCost - extraExpensesTotal;
      }
    }

    return {
      ...base,
      ...adminExtras,
      finance: {
        costPrice,
        estimatedSalePrice,
        finalSalePrice,
        extraExpenseItems,
        extraExpensesTotal,
        internalNotes: product.finance?.internalNotes ?? null,

        estimatedProfit:
          saleCurrency === 'ARS'
            ? estimatedProfitByCurrency.ARS
            : estimatedProfitByCurrency.USD,

        realProfit:
          finalSalePrice != null && finalSalePrice > 0
            ? saleCurrency === 'ARS'
              ? realProfitByCurrency.ARS
              : realProfitByCurrency.USD
            : null,

        estimatedProfitByCurrency,
        realProfitByCurrency,
      },
    };
  }

private normalizeDocuments(documents: ProductDocumentDto[] = []) {
  return documents
    .map((document) => {
      const uploadedAt =
        document.uploadedAt !== undefined
          ? this.parseDateOrNull(document.uploadedAt, 'documents.uploadedAt')
          : new Date();

      return {
        label: document.label?.trim(),
        type: document.type?.trim(),
        url: document.url,
        publicId: document.publicId,
        fileName: document.fileName?.trim() || null,
        mimeType: document.mimeType?.trim() || null,
        uploadedAt: uploadedAt ?? new Date(),
      };
    })
    .filter(
      (document) =>
        document.label &&
        document.type &&
        document.url &&
        document.publicId,
    );
}

  private serializeDocument(document: any) {
    return {
      label: document?.label ?? '',
      type: document?.type ?? '',
      url: document?.url ?? '',
      publicId: document?.publicId ?? '',
      fileName: document?.fileName ?? null,
      mimeType: document?.mimeType ?? null,
      uploadedAt: document?.uploadedAt ?? null,
    };
  }
}