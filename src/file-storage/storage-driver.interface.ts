export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER');

export interface StoragePutMeta {
  contentType: string;
  contentLength: number;
}

export interface StorageDriver {
  put(key: string, body: Buffer, meta: StoragePutMeta): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
  url(key: string): string;
}
