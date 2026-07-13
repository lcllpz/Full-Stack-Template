import {
  HttpStatus,
  Injectable,
  PipeTransform,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AllConfigType } from '@/config/config.type';
import { fileStorageConfigKey } from '@/config/fileStorage/config';

@Injectable()
export class AvatarFileValidationPipe implements PipeTransform<
  Express.Multer.File | undefined,
  Express.Multer.File
> {
  private readonly maxSize: number;
  private readonly allowedMimeTypes: Set<string>;

  constructor(configService: ConfigService<AllConfigType>) {
    const config = configService.getOrThrow(fileStorageConfigKey, { infer: true });
    this.maxSize = config.UPLOAD_MAX_SIZE_BYTES;
    this.allowedMimeTypes = new Set(config.UPLOAD_ALLOWED_MIME_TYPES);
  }

  transform(file: Express.Multer.File | undefined): Express.Multer.File {
    if (!file) {
      this.throwAvatarError('请选择要上传的头像文件');
    }
    if (file.size > this.maxSize) {
      this.throwAvatarError(`头像大小不能超过 ${this.maxSize} 字节`);
    }

    const detectedMimeType = this.detectImageMimeType(file.buffer);
    if (
      !detectedMimeType ||
      detectedMimeType !== file.mimetype.toLowerCase() ||
      !this.allowedMimeTypes.has(detectedMimeType)
    ) {
      this.throwAvatarError('仅支持 JPEG、PNG 或 WebP 图片，且文件内容必须与类型一致');
    }

    file.mimetype = detectedMimeType;
    return file;
  }

  private detectImageMimeType(buffer: Buffer): string | null {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg';
    }

    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (buffer.length >= pngSignature.length && buffer.subarray(0, 8).equals(pngSignature)) {
      return 'image/png';
    }

    if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return 'image/webp';
    }

    return null;
  }

  private throwAvatarError(message: string): never {
    throw new UnprocessableEntityException({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      message,
      errors: { avatar: message },
    });
  }
}
