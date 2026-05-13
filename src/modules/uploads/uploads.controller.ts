import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
        fileSize: 6 * 1024 * 1024,
      },
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: { user: CurrentUser },
  ) {
    return this.uploadsService.uploadImage(file, req.user);
  }

  @Post('document')
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
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: { user: CurrentUser },
  ) {
    return this.uploadsService.uploadDocument(file, req.user);
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

    return this.uploadsService.deleteImage(dto.publicId, req.user);
  }

  @Delete('document')
  @ApiBody({
    type: DeleteImageDto,
  })
  async deleteDocument(
    @Body() dto: DeleteImageDto,
    @Req() req: { user: CurrentUser },
  ) {
    if (req.user.role !== UserRole.OWNER) {
      throw new ForbiddenException('Only OWNER can delete documents');
    }

    return this.uploadsService.deleteDocument(dto.publicId, req.user);
  }
}