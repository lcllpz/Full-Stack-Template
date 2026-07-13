import { ConfigService } from '@nestjs/config';

import { AllConfigType } from '@/config/config.type';
import { StorageDriver } from '@/config/fileStorage/config.type';

import { AvatarFileValidationPipe } from './avatar-file-validation.pipe';

describe('AvatarFileValidationPipe', () => {
  let pipe: AvatarFileValidationPipe;

  beforeEach(() => {
    const configService = {
      getOrThrow: () => ({
        STORAGE_DRIVER: StorageDriver.Local,
        UPLOAD_DIR: 'uploads',
        UPLOAD_PUBLIC_BASE_URL: 'http://localhost:4000/uploads',
        UPLOAD_MAX_SIZE_BYTES: 16,
        UPLOAD_ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
      }),
    } as unknown as ConfigService<AllConfigType>;
    pipe = new AvatarFileValidationPipe(configService);
  });

  it('接受文件签名与 MIME 一致的 PNG', () => {
    const file = createFile(
      'image/png',
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );

    expect(pipe.transform(file)).toBe(file);
  });

  it('拒绝只伪造 MIME 的文件', () => {
    const file = createFile('image/png', Buffer.from('not-an-image'));

    expect(() => pipe.transform(file)).toThrow('仅支持 JPEG、PNG 或 WebP');
  });

  it('拒绝缺失文件', () => {
    expect(() => pipe.transform(undefined)).toThrow('请选择要上传的头像文件');
  });

  it('拒绝超过配置上限的文件', () => {
    const file = createFile('image/png', Buffer.alloc(17));

    expect(() => pipe.transform(file)).toThrow('头像大小不能超过 16 字节');
  });
});

function createFile(mimetype: string, buffer: Buffer): Express.Multer.File {
  return {
    fieldname: 'avatar',
    originalname: 'avatar.png',
    encoding: '7bit',
    mimetype,
    size: buffer.length,
    buffer,
    destination: '',
    filename: '',
    path: '',
    stream: null as never,
  };
}
