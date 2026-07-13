import { createReadStream, type Dirent } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import {
  Controller,
  Get,
  NotFoundException,
  Post,
  Request,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { Public } from '@/auth/guards/jwt-auth.guard';

import { AvatarFileValidationPipe } from './pipes/avatar-file-validation.pipe';
import { AVATAR_UPLOAD_THROTTLE } from './file.constants';
import { FileService } from './file.service';

const STREAMING_FILES_DIRECTORY = resolve(__dirname, '..', '..', 'uploads', 'streamingFiles');

@ApiTags('文件')
@Controller('file')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post('upload/avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  @Throttle({ default: AVATAR_UPLOAD_THROTTLE })
  // @Public()
  @ApiOperation({ summary: '上传并更新当前用户头像' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['avatar'],
      properties: {
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'JPEG、PNG 或 WebP 图片',
        },
      },
    },
  })
  uploadFileAvatar(
    @Request() request: { user: { userId: string } },
    @UploadedFile(AvatarFileValidationPipe) file: Express.Multer.File,
  ) {
    return this.fileService.uploadAvatar(request.user.userId, file);
  }

  @Post('upload/avatar/public')
  @UseInterceptors(FileInterceptor('avatar'))
  @Throttle({ default: AVATAR_UPLOAD_THROTTLE })
  @Public()
  @ApiOperation({ summary: '上传用户头像' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['avatar'],
      properties: {
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'JPEG、PNG 或 WebP 图片',
        },
      },
    },
  })
  uploadFile(@UploadedFile(AvatarFileValidationPipe) file: Express.Multer.File) {
    return this.fileService.uploadAvatarPublic(file);
  }

  @Get()
  @ApiOperation({ summary: '流式下载 streamingFiles 目录中的文件' })
  @ApiProduces('application/octet-stream')
  @ApiResponse({ status: 200, description: '返回目录中的第一个文件' })
  @ApiResponse({ status: 404, description: '目录不存在或目录中没有文件' })
  @Public()
  async getFile(): Promise<StreamableFile> {
    let entries: Dirent[];
    try {
      entries = await readdir(STREAMING_FILES_DIRECTORY, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundException(
          '下载目录不存在，请先创建 apps/back/uploads/streamingFiles 目录',
        );
      }
      throw error;
    }

    const fileName = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right))[0];
    if (!fileName) {
      throw new NotFoundException('uploads/streamingFiles 目录下没有可下载的文件');
    }

    const filePath = join(STREAMING_FILES_DIRECTORY, fileName);
    const fileStats = await stat(filePath);
    const fallbackFileName = fileName.replace(/[^\x20-\x7e]|["\\]/g, '_') || 'download';

    return new StreamableFile(createReadStream(filePath), {
      type: 'application/octet-stream',
      disposition: `attachment; filename="${fallbackFileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      // 明确文件长度，便于客户端展示下载进度。
      length: fileStats.size,
    });
  }
}
