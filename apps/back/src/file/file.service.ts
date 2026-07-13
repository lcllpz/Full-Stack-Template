import { Inject, Injectable, Logger } from '@nestjs/common';

import { UserService } from '@/user/user.service';

import type { StorageProvider, StoredFile } from './storage/storage.interface';
import { STORAGE_PROVIDER } from './storage/storage.interface';

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);

  constructor(
    @Inject(STORAGE_PROVIDER) private readonly storageProvider: StorageProvider,
    private readonly userService: UserService,
  ) {}

  async uploadAvatar(userId: string, file: Express.Multer.File): Promise<StoredFile> {
    const user = await this.userService.findOne(userId);
    const storedFile = await this.storageProvider.save({
      buffer: file.buffer,
      mimeType: file.mimetype,
      size: file.size,
      purpose: 'avatar',
    });

    try {
      await this.userService.update(userId, { avatar: storedFile.url });
    } catch (error) {
      await this.deleteWithoutMaskingError(storedFile.key);
      throw error;
    }

    const previousKey = user.avatar ? this.storageProvider.keyFromUrl(user.avatar) : null;
    if (previousKey && previousKey !== storedFile.key) {
      await this.deleteWithoutMaskingError(previousKey);
    }

    return storedFile;
  }

  async uploadAvatarPublic(file: Express.Multer.File): Promise<StoredFile> {
    const storedFile = await this.storageProvider.save({
      buffer: file.buffer,
      mimeType: file.mimetype,
      size: file.size,
      purpose: 'avatar',
    });
    return storedFile;
  }

  private async deleteWithoutMaskingError(key: string): Promise<void> {
    try {
      await this.storageProvider.delete(key);
    } catch (error) {
      this.logger.warn(`清理文件失败：${key}`, error);
    }
  }
}
