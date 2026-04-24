import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  PayloadTooLargeException,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '../../common/enums/user-role.enum';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DeleteImageDto } from './dto/delete-image.dto';
import { UploadsService } from './uploads.service';

@ApiTags('Uploads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('image')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 6 * 1024 * 1024, // 6MB
      },
      fileFilter: (_req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          return callback(
            new BadRequestException('El archivo debe ser una imagen'),
            false,
          );
        }

        callback(null, true);
      },
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: { user: CurrentUser },
  ) {
    console.log('UPLOAD IMAGE HIT');
    console.log('user exists:', !!req.user);
    console.log('file exists:', !!file);
    console.log('file size:', file?.size);
    console.log('file mimetype:', file?.mimetype);

    console.log('cloudinary envs:', {
      cloudName: !!process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: !!process.env.CLOUDINARY_API_KEY,
      apiSecret: !!process.env.CLOUDINARY_API_SECRET,
      folder: process.env.CLOUDINARY_FOLDER || null,
    });

    if (!file) {
      throw new BadRequestException(
        'No se recibió ninguna imagen. El campo del FormData debe llamarse "file".',
      );
    }

    if (file.size > 6 * 1024 * 1024) {
      throw new PayloadTooLargeException(
        'La imagen supera el tamaño máximo permitido de 6MB',
      );
    }

    try {
      return await this.uploadsService.uploadImage(file, req.user);
    } catch (error) {
      console.error('UPLOAD IMAGE ERROR:', error);
      throw error;
    }
  }

  @Delete('image')
  @ApiBody({
    type: DeleteImageDto,
  })
  async deleteImage(
    @Body() dto: DeleteImageDto,
    @Req() req: { user: CurrentUser },
  ) {
    if (req.user.role !== UserRole.OWNER) {
      throw new ForbiddenException('Only OWNER can delete images');
    }

    if (!dto.publicId) {
      throw new BadRequestException('Falta publicId');
    }

    return this.uploadsService.deleteImage(dto.publicId, req.user);
  }
}