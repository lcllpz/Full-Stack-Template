import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';

import { Injectable, UnsupportedMediaTypeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AllConfigType } from '@/config/config.type';
import { fileStorageConfigKey } from '@/config/fileStorage/config';

import { SaveFileInput, StorageProvider, StoredFile } from './storage.interface';

const MIME_EXTENSIONS: Readonly<Record<string, string>> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly rootDirectory: string;
  private readonly publicBaseUrl: string;

  constructor(configService: ConfigService<AllConfigType>) {
    const config = configService.getOrThrow(fileStorageConfigKey, { infer: true });
    this.rootDirectory = resolve(config.UPLOAD_DIR);
    this.publicBaseUrl = config.UPLOAD_PUBLIC_BASE_URL.replace(/\/+$/, '');
  }

  async save(input: SaveFileInput): Promise<StoredFile> {
    const extension = MIME_EXTENSIONS[input.mimeType];
    if (!extension) {
      throw new UnsupportedMediaTypeException(`不支持的文件类型：${input.mimeType}`);
    }

    const key = `${input.purpose}s/${randomUUID()}${extension}`;
    const filePath = this.resolveKey(key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, input.buffer, { flag: 'wx' });

    return {
      key,
      url: `${this.publicBaseUrl}/${key}`,
      size: input.size,
      mimeType: input.mimeType,
    };
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolveKey(key);
    try {
      await unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  keyFromUrl(url: string): string | null {
    const prefix = `${this.publicBaseUrl}/`;
    if (!url.startsWith(prefix)) {
      return null;
    }

    const key = url.slice(prefix.length);
    try {
      this.resolveKey(key);
      return key;
    } catch {
      return null;
    }
  }

  private resolveKey(key: string): string {
    if (!key || isAbsolute(key) || extname(key).length === 0) {
      throw new Error('无效的文件存储 key');
    }

    const filePath = resolve(this.rootDirectory, key);
    const relativePath = relative(this.rootDirectory, filePath);
    if (
      relativePath === '' ||
      relativePath === '..' ||
      relativePath.startsWith(`..${sep}`) ||
      isAbsolute(relativePath)
    ) {
      throw new Error('文件存储 key 超出上传目录');
    }

    return join(this.rootDirectory, relativePath);
  }
}
