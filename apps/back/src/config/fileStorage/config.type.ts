export enum StorageDriver {
  Local = 'local',
  Oss = 'oss',
}

export type StorageConfigType = {
  STORAGE_DRIVER: StorageDriver;
  UPLOAD_DIR: string;
  UPLOAD_PUBLIC_BASE_URL: string;
  UPLOAD_MAX_SIZE_BYTES: number;
  UPLOAD_ALLOWED_MIME_TYPES: string[];
};
