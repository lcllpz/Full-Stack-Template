import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ConfigService } from '@nestjs/config';

import { AllConfigType } from '@/config/config.type';
import { StorageDriver } from '@/config/fileStorage/config.type';

import { LocalStorageProvider } from './local-storage.provider';

describe('LocalStorageProvider', () => {
  let directory: string;
  let provider: LocalStorageProvider;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'avatar-storage-'));
    const configService = {
      getOrThrow: () => ({
        STORAGE_DRIVER: StorageDriver.Local,
        UPLOAD_DIR: directory,
        UPLOAD_PUBLIC_BASE_URL: 'http://localhost:4000/uploads',
        UPLOAD_MAX_SIZE_BYTES: 1024,
        UPLOAD_ALLOWED_MIME_TYPES: ['image/png'],
      }),
    } as unknown as ConfigService<AllConfigType>;
    provider = new LocalStorageProvider(configService);
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('保存文件并生成可反解的公开 URL', async () => {
    const buffer = Buffer.from('png-content');

    const stored = await provider.save({
      buffer,
      mimeType: 'image/png',
      size: buffer.length,
      purpose: 'avatar',
    });

    expect(stored.key).toMatch(/^avatars\/[\w-]+\.png$/);
    expect(stored.url).toBe(`http://localhost:4000/uploads/${stored.key}`);
    expect(provider.keyFromUrl(stored.url)).toBe(stored.key);
    await expect(readFile(join(directory, stored.key))).resolves.toEqual(buffer);

    await provider.delete(stored.key);
    await expect(readFile(join(directory, stored.key))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('不会把外部 URL 识别为本地文件', () => {
    expect(provider.keyFromUrl('https://example.com/avatar.png')).toBeNull();
  });

  it('拒绝目录穿越 key', async () => {
    await expect(provider.delete('../outside.png')).rejects.toThrow('超出上传目录');
  });
});
