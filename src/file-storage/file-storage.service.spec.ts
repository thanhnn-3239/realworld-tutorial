import { BadGatewayException } from '@nestjs/common';
import { FileStorageService } from './file-storage.service';
import { StorageDriver } from './storage-driver.interface';
import { CustomLoggerService } from '../logger/logger.service';

const makeMockFile = (
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File =>
  ({
    originalname: 'avatar.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from('fake-image-data'),
    ...overrides,
  }) as Express.Multer.File;

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
    const key = 'avatars/42/photo.jpg';

    it('returns the provided key', async () => {
      const file = makeMockFile();
      const result = await service.upload(key, file);

      expect(result).toBe(key);
    });

    it('returns the key alone, leaving URL building to publicUrl', async () => {
      const file = makeMockFile();
      await service.upload(key, file);

      expect(driver.url).not.toHaveBeenCalled();
    });

    it('calls driver.put with the key, Content-Type, and length', async () => {
      const file = makeMockFile({
        mimetype: 'image/png',
        originalname: 'pic.png',
      });
      await service.upload('avatars/42/pic.png', file);

      expect(driver.put).toHaveBeenCalledWith(
        'avatars/42/pic.png',
        file.buffer,
        { contentType: 'image/png', contentLength: file.size },
      );
    });

    it('calls driver.put with the file buffer as the body', async () => {
      const buffer = Buffer.from('image-bytes');
      const file = makeMockFile({ buffer });
      await service.upload(key, file);

      expect(driver.put).toHaveBeenCalledWith(key, buffer, expect.anything());
    });

    it('throws BadGatewayException when the driver fails', async () => {
      driver.put.mockRejectedValueOnce(new Error('S3 network error'));
      const file = makeMockFile();

      await expect(service.upload(key, file)).rejects.toThrow(
        new BadGatewayException('File upload failed'),
      );
    });

    it('logs the underlying cause, which the thrown 502 does not carry', async () => {
      driver.put.mockRejectedValueOnce(new Error('S3 network error'));
      const file = makeMockFile();

      await expect(service.upload(key, file)).rejects.toThrow(
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
