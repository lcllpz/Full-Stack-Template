import {
  CallHandler,
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  NestInterceptor,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { MulterModule } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { map, Observable } from 'rxjs';
import request from 'supertest';
import { App } from 'supertest/types';

import { StorageDriver } from '../src/config/fileStorage/config.type';
import { FileController } from '../src/file/file.controller';
import { FileService } from '../src/file/file.service';
import { AvatarFileValidationPipe } from '../src/file/pipes/avatar-file-validation.pipe';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('头像上传接口 (e2e)', () => {
  let app: INestApplication<App>;
  const fileService = {
    uploadAvatar: jest.fn().mockResolvedValue({
      key: 'avatars/new.png',
      url: 'http://localhost:4000/uploads/avatars/new.png',
      size: PNG.length,
      mimeType: 'image/png',
    }),
  };

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [MulterModule.register({ limits: { fileSize: 16, files: 1 } })],
      controllers: [FileController],
      providers: [
        AvatarFileValidationPipe,
        { provide: FileService, useValue: fileService },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: () => ({
              STORAGE_DRIVER: StorageDriver.Local,
              UPLOAD_DIR: 'uploads',
              UPLOAD_PUBLIC_BASE_URL: 'http://localhost:4000/uploads',
              UPLOAD_MAX_SIZE_BYTES: 16,
              UPLOAD_ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
            }),
          },
        },
        { provide: APP_GUARD, useClass: TestJwtGuard },
        { provide: APP_INTERCEPTOR, useClass: TestEnvelopeInterceptor },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    fileService.uploadAvatar.mockClear();
  });

  it('携带 JWT 和合法图片时更新当前用户头像', async () => {
    const response = await request(app.getHttpServer())
      .post('/file/upload/avatar')
      .set('Authorization', 'Bearer test-token')
      .attach('avatar', PNG, { filename: 'avatar.png', contentType: 'image/png' })
      .expect(201);

    expect(response.body).toEqual({
      code: 201,
      message: 'ok',
      data: {
        key: 'avatars/new.png',
        url: 'http://localhost:4000/uploads/avatars/new.png',
        size: PNG.length,
        mimeType: 'image/png',
      },
    });
    expect(fileService.uploadAvatar).toHaveBeenCalledWith('user-1', expect.any(Object));
  });

  it('未携带 JWT 时返回 401', () =>
    request(app.getHttpServer())
      .post('/file/upload/avatar')
      .attach('avatar', PNG, { filename: 'avatar.png', contentType: 'image/png' })
      .expect(401));

  it('缺少头像文件时返回 422', () =>
    request(app.getHttpServer())
      .post('/file/upload/avatar')
      .set('Authorization', 'Bearer test-token')
      .expect(422));

  it('文件内容与 MIME 不一致时返回 422', () =>
    request(app.getHttpServer())
      .post('/file/upload/avatar')
      .set('Authorization', 'Bearer test-token')
      .attach('avatar', Buffer.from('fake-png'), {
        filename: 'avatar.png',
        contentType: 'image/png',
      })
      .expect(422));

  it('文件超过 Multer 上限时返回 413', () =>
    request(app.getHttpServer())
      .post('/file/upload/avatar')
      .set('Authorization', 'Bearer test-token')
      .attach('avatar', Buffer.alloc(17), {
        filename: 'avatar.png',
        contentType: 'image/png',
      })
      .expect(413));
});

@Injectable()
class TestJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: { userId: string };
    }>();
    if (request.headers.authorization !== 'Bearer test-token') {
      throw new UnauthorizedException();
    }
    request.user = { userId: 'user-1' };
    return true;
  }
}

@Injectable()
class TestEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<{ statusCode: number }>();
    return next.handle().pipe(map((data) => ({ code: response.statusCode, message: 'ok', data })));
  }
}
