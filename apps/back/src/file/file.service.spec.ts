import { UserService } from '@/user/user.service';

import type { StorageProvider, StoredFile } from './storage/storage.interface';
import { FileService } from './file.service';

describe('FileService', () => {
  const storedFile: StoredFile = {
    key: 'avatars/new.png',
    url: 'http://localhost:4000/uploads/avatars/new.png',
    size: 8,
    mimeType: 'image/png',
  };

  let storageProvider: jest.Mocked<StorageProvider>;
  let userService: jest.Mocked<Pick<UserService, 'findOne' | 'update'>>;
  let service: FileService;

  beforeEach(() => {
    storageProvider = {
      save: jest.fn().mockResolvedValue(storedFile),
      delete: jest.fn().mockResolvedValue(undefined),
      keyFromUrl: jest.fn().mockReturnValue('avatars/old.png'),
    };
    userService = {
      findOne: jest.fn().mockResolvedValue({ avatar: 'http://localhost/uploads/avatars/old.png' }),
      update: jest.fn().mockResolvedValue({ avatar: storedFile.url }),
    };
    service = new FileService(storageProvider, userService as unknown as UserService);
  });

  it('保存头像、更新用户并清理旧的本地头像', async () => {
    const result = await service.uploadAvatar('user-1', createFile());

    expect(result).toEqual(storedFile);
    expect(storageProvider.save).toHaveBeenCalledWith({
      buffer: expect.any(Buffer),
      mimeType: 'image/png',
      size: 8,
      purpose: 'avatar',
    });
    expect(userService.update).toHaveBeenCalledWith('user-1', { avatar: storedFile.url });
    expect(storageProvider.delete).toHaveBeenCalledWith('avatars/old.png');
  });

  it('数据库更新失败时回滚刚保存的文件', async () => {
    userService.update.mockRejectedValueOnce(new Error('database failed'));

    await expect(service.uploadAvatar('user-1', createFile())).rejects.toThrow('database failed');
    expect(storageProvider.delete).toHaveBeenCalledWith(storedFile.key);
  });

  it('不会删除不属于当前存储实现的旧 URL', async () => {
    storageProvider.keyFromUrl.mockReturnValueOnce(null);

    await service.uploadAvatar('user-1', createFile());

    expect(storageProvider.delete).not.toHaveBeenCalled();
  });
});

function createFile(): Express.Multer.File {
  return {
    fieldname: 'avatar',
    originalname: 'avatar.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: 8,
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    destination: '',
    filename: '',
    path: '',
    stream: null as never,
  };
}
