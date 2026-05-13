import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Model, Types } from 'mongoose';
import { Readable } from 'stream';
import sharp from 'sharp';
import { UserRole } from '../../common/enums/user-role.enum';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import {
  Business,
  BusinessDocument,
} from '../businesses/schemas/businesses.schema';

@Injectable()
export class UploadsService {
  private readonly allowedImageMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/avif',
  ];

  private readonly allowedDocumentMimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ];

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(Business.name)
    private readonly businessModel: Model<BusinessDocument>,
  ) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadImage(file: Express.Multer.File, currentUser: CurrentUser) {
    if (!currentUser?.businessId) {
      throw new ForbiddenException('User is not linked to a business');
    }

    if (
      ![UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR].includes(
        currentUser.role,
      )
    ) {
      throw new ForbiddenException('You are not allowed to upload images');
    }

    this.validateImageFile(file);

    const business = await this.getBusinessOrFail(currentUser.businessId);
    const folder = this.buildBusinessFolder(business.slug);

    const optimized = await this.optimizeImage(file);

    const result = await this.uploadBuffer(optimized.buffer, {
      folder,
      resource_type: 'image',
      overwrite: false,
      unique_filename: true,
      use_filename: false,
      format: optimized.format,
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
      folder,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
      originalFilename: file.originalname,
      business: {
        id: business.id,
        slug: business.slug,
        name: business.name,
      },
    };
  }

  async uploadDocument(file: Express.Multer.File, currentUser: CurrentUser) {
    if (!currentUser?.businessId) {
      throw new ForbiddenException('User is not linked to a business');
    }

    if (
      ![UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR].includes(
        currentUser.role,
      )
    ) {
      throw new ForbiddenException('You are not allowed to upload documents');
    }

    this.validateDocumentFile(file);

    const business = await this.getBusinessOrFail(currentUser.businessId);
    const folder = `${this.buildBusinessFolder(business.slug)}/documents`;

    const safeFileName = this.sanitizeFileName(file.originalname);

    const result = await this.uploadBuffer(file.buffer, {
      folder,
      resource_type: 'raw',
      overwrite: false,
      unique_filename: true,
      use_filename: true,
      filename_override: safeFileName,
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
      folder,
      fileName: file.originalname,
      mimeType: file.mimetype,
      bytes: result.bytes,
      format: result.format ?? null,
      uploadedAt: new Date().toISOString(),
      business: {
        id: business.id,
        slug: business.slug,
        name: business.name,
      },
    };
  }

  async deleteImage(publicId: string, currentUser: CurrentUser) {
    if (!currentUser?.businessId) {
      throw new ForbiddenException('User is not linked to a business');
    }

    if (currentUser.role !== UserRole.OWNER) {
      throw new ForbiddenException('Only OWNER can delete images');
    }

    if (!publicId || typeof publicId !== 'string') {
      throw new BadRequestException('publicId is required');
    }

    const business = await this.getBusinessOrFail(currentUser.businessId);
    const expectedPrefix = `${this.buildBusinessFolder(business.slug)}/`;

    if (!publicId.startsWith(expectedPrefix)) {
      throw new ForbiddenException(
        'You can only delete images from your own business folder',
      );
    }

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
      invalidate: true,
    });

    if (!result || !('result' in result)) {
      throw new BadRequestException('Unexpected Cloudinary delete response');
    }

    if (result.result !== 'ok' && result.result !== 'not found') {
      throw new BadRequestException(
        `Cloudinary could not delete the image: ${result.result}`,
      );
    }

    return {
      message:
        result.result === 'ok'
          ? 'Image deleted successfully'
          : 'Image not found in Cloudinary',
      publicId,
      result: result.result,
      business: {
        id: business.id,
        slug: business.slug,
        name: business.name,
      },
    };
  }

  async deleteDocument(publicId: string, currentUser: CurrentUser) {
    if (!currentUser?.businessId) {
      throw new ForbiddenException('User is not linked to a business');
    }

    if (currentUser.role !== UserRole.OWNER) {
      throw new ForbiddenException('Only OWNER can delete documents');
    }

    if (!publicId || typeof publicId !== 'string') {
      throw new BadRequestException('publicId is required');
    }

    const business = await this.getBusinessOrFail(currentUser.businessId);
    const expectedPrefix = `${this.buildBusinessFolder(business.slug)}/documents/`;

    if (!publicId.startsWith(expectedPrefix)) {
      throw new ForbiddenException(
        'You can only delete documents from your own business folder',
      );
    }

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'raw',
      invalidate: true,
    });

    if (!result || !('result' in result)) {
      throw new BadRequestException('Unexpected Cloudinary delete response');
    }

    if (result.result !== 'ok' && result.result !== 'not found') {
      throw new BadRequestException(
        `Cloudinary could not delete the document: ${result.result}`,
      );
    }

    return {
      message:
        result.result === 'ok'
          ? 'Document deleted successfully'
          : 'Document not found in Cloudinary',
      publicId,
      result: result.result,
      business: {
        id: business.id,
        slug: business.slug,
        name: business.name,
      },
    };
  }

  private validateImageFile(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (!file.mimetype || !this.allowedImageMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Only JPG, JPEG, PNG, WEBP or AVIF images are allowed',
      );
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Invalid file');
    }
  }

  private validateDocumentFile(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (
      !file.mimetype ||
      !this.allowedDocumentMimeTypes.includes(file.mimetype)
    ) {
      throw new BadRequestException(
        'Only PDF, JPG, JPEG, PNG or WEBP documents are allowed',
      );
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Invalid file');
    }
  }

  private async getBusinessOrFail(businessId: string) {
    if (!Types.ObjectId.isValid(businessId)) {
      throw new BadRequestException('Invalid businessId');
    }

    const business = await this.businessModel
      .findById(new Types.ObjectId(businessId))
      .exec();

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    return business;
  }

  private getBaseFolder() {
    const raw =
      this.configService.get<string>('CLOUDINARY_FOLDER') || 'businesses';

    return raw
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '');
  }

  private sanitizePathSegment(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  }

  private sanitizeFileName(value: string) {
    const cleaned = value
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-_.]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');

    return cleaned || 'documento';
  }

  private buildBusinessFolder(slug: string) {
    const safeSlug = this.sanitizePathSegment(slug || 'general');
    return `${this.getBaseFolder()}/${safeSlug}`;
  }

  private uploadBuffer(
    buffer: Buffer,
    options: Record<string, any>,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        options,
        (error, result) => {
          if (error) {
            return reject(error);
          }

          if (!result) {
            return reject(new BadRequestException('Cloudinary upload failed'));
          }

          resolve(result);
        },
      );

      Readable.from(buffer).pipe(stream);
    });
  }

  private async optimizeImage(file: Express.Multer.File): Promise<{
    buffer: Buffer;
    format: 'jpg' | 'webp' | 'png';
  }> {
    const image = sharp(file.buffer).rotate();
    const metadata = await image.metadata();

    const hasAlpha = metadata.hasAlpha === true;
    const isPng = file.mimetype === 'image/png';

    if (isPng && hasAlpha) {
      const buffer = await image
        .resize({
          width: 1600,
          height: 1600,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .png({
          compressionLevel: 9,
        })
        .toBuffer();

      return {
        buffer,
        format: 'png',
      };
    }

    const buffer = await image
      .resize({
        width: 1600,
        height: 1600,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({
        quality: 78,
        mozjpeg: true,
      })
      .toBuffer();

    return {
      buffer,
      format: 'jpg',
    };
  }
}