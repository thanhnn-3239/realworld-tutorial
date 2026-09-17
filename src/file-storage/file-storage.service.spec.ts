import { BadGatewayException } from '@nestjs/common';
import { FileStorageService } from './file-storage.service';
import { StorageDriver } from './storage-driver.interface';
import { StorageUpload } from './storage-upload.interface';
import { CustomLoggerService } from '../logger/logger.service';

const makeUpload = (overrides: Partial<StorageUpload> = {}): StorageUpload => {
  const data = overrides.data ?? new Uint8Array(Buffer.from('fake-image-data'));
  return {
    data,
    mimeType: 'image/webp',
    size: data.byteLength,
    ...overrides,
  };
};

const makeDriver = (): jest.Mocked<StorageDriver> => ({
  put: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(undefined),
  list: jest.fn().mockResolvedValue([]),
  url: jest.fn((key: string) => `https://cdn.test/${key}`),
});

const makeLogger = () =>
  ({ error: jest.fn(), log: jest.fn() }) as unknown as CustomLoggerService;

describe('FileStorageService', () => {
  let service: FileStorageService;
  let driver: jest.Mocked<StorageDriver>;
  let logger: CustomLoggerService;

  beforeEach(() => {
    jest.clearAllMocks();
    driver = makeDriver();
    logger = makeLogger();
    service = new FileStorageService(driver, logger);
  });

  describe('upload', () => {
    const key = 'avatars/42/photo.webp';

    it('returns the provided key', async () => {
      const upload = makeUpload();
      const result = await service.upload(key, upload);

      expect(result).toBe(key);
    });

    it('returns the key alone, leaving URL building to publicUrl', async () => {
      const upload = makeUpload();
      await service.upload(key, upload);

      expect(driver.url).not.toHaveBeenCalled();
    });

    it('calls driver.put with the key, a Buffer of the same bytes, and Content-Type/length', async () => {
      const data = new Uint8Array(Buffer.from('image-bytes'));
      const upload = makeUpload({ data, mimeType: 'image/webp' });
      await service.upload(key, upload);

      expect(driver.put).toHaveBeenCalledWith(key, Buffer.from(data), {
        contentType: 'image/webp',
        contentLength: data.byteLength,
      });
    });

    it('uses data.byteLength as the authoritative content length, ignoring a lying size field', async () => {
      const data = new Uint8Array(Buffer.from('image-bytes'));
      const upload = makeUpload({ data, size: 999999 });
      await service.upload(key, upload);

      expect(driver.put).toHaveBeenCalledWith(
        key,
        expect.anything(),
        expect.objectContaining({ contentLength: data.byteLength }),
      );
    });

    it('throws BadGatewayException when the driver fails', async () => {
      driver.put.mockRejectedValueOnce(new Error('S3 network error'));
      const upload = makeUpload();

      await expect(service.upload(key, upload)).rejects.toThrow(
        new BadGatewayException('File upload failed'),
      );
    });

    it('logs the underlying cause, which the thrown 502 does not carry', async () => {
      driver.put.mockRejectedValueOnce(new Error('S3 network error'));
      const upload = makeUpload();

      await expect(service.upload(key, upload)).rejects.toThrow(
        BadGatewayException,
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('S3 network error'),
        expect.anything(),
      );
    });
  });

  describe('delete', () => {
    const key = 'avatars/42/old.png';

    it('calls driver.delete with the key', async () => {
      await service.delete(key);

      expect(driver.delete).toHaveBeenCalledWith(key);
    });

    it('records the deletion, so a missing avatar can be traced later', async () => {
      await service.delete(key);

      expect(logger.log).toHaveBeenCalledWith(`Deleted stored object ${key}`);
    });

    it('resolves when the same key is deleted more than once', async () => {
      await expect(service.delete(key)).resolves.toBeUndefined();
      await expect(service.delete(key)).resolves.toBeUndefined();

      expect(driver.delete).toHaveBeenCalledTimes(2);
    });

    it('maps a driver deletion failure to a BadGatewayException and logs its cause', async () => {
      driver.delete.mockRejectedValueOnce(new Error('S3 delete network error'));

      await expect(service.delete(key)).rejects.toThrow(
        new BadGatewayException('File deletion failed'),
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(key),
        expect.anything(),
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('S3 delete network error'),
        expect.anything(),
      );
    });
  });

  describe('publicUrl', () => {
    it('turns a stored key into the public URL', () => {
      expect(service.publicUrl('avatars/42/a.png')).toBe(
        'https://cdn.test/avatars/42/a.png',
      );
    });

    it('passes null through, so an avatar-less user stays avatar-less', () => {
      expect(service.publicUrl(null)).toBeNull();
    });
  });
});
