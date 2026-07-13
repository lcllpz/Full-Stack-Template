export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

export type SaveFileInput = {
  buffer: Buffer;
  mimeType: string;
  size: number;
  purpose: 'avatar';
};

export type StoredFile = {
  key: string;
  url: string;
  size: number;
  mimeType: string;
};

/**
 * 文件业务只依赖该契约，后续可增加阿里云 OSS 等实现。
 */
export interface StorageProvider {
  save(input: SaveFileInput): Promise<StoredFile>;
  delete(key: string): Promise<void>;
  keyFromUrl(url: string): string | null;
}
