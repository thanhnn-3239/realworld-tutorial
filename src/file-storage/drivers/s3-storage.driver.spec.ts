import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { S3StorageDriver } from './s3-storage.driver';

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({}),
  })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  ListObjectsV2Command: jest.fn().mockImplementation((input) => ({ input })),
}));

const makeConfigService = (overrides: Record<string, string> = {}) => {
  const defaults: Record<string, string> = {
    STORAGE_BUCKET: 'test-bucket',
    STORAGE_ACCESS_KEY: 'key',
    STORAGE_SECRET_KEY: 'secret',
    STORAGE_PUBLIC_URL: 'http://localhost:9000/test-bucket',
    STORAGE_REGION: 'us-east-1',
  };
  return {
    get: jest.fn(
      <T>(key: string, defaultValue?: T) =>
        (({ ...defaults, ...overrides })[key] as T | undefined) ?? defaultValue,
    ),
  } as unknown as ConfigService;
};

describe('S3StorageDriver', () => {
  let driver: S3StorageDriver;
  let mockS3Send: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    driver = new S3StorageDriver(makeConfigService());
    mockS3Send = (S3Client as jest.Mock).mock.results[0].value.send;
  });

  describe('configuration', () => {
    it.each(['STORAGE_BUCKET', 'STORAGE_PUBLIC_URL'])(
      'refuses to construct when %s is missing',
      (missingKey) => {
        const configService = makeConfigService({ [missingKey]: '' });

        expect(() => new S3StorageDriver(configService)).toThrow(
          `${missingKey} is not defined in environment variables`,
        );
      },
    );
  });

  describe('put', () => {
    it('sends a PutObjectCommand with Bucket, Key, Body, ContentType, ContentLength', async () => {
      const body = Buffer.from('image-bytes');
      await driver.put('uploads/User/42/fixed-uuid.png', body, {
        contentType: 'image/png',
        contentLength: body.length,
      });

      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'uploads/User/42/fixed-uuid.png',
        Body: body,
        ContentType: 'image/png',
        ContentLength: body.length,
      });
    });

    it('propagates the raw SDK rejection without translating it', async () => {
      mockS3Send.mockRejectedValueOnce(new Error('S3 network error'));

      await expect(
        driver.put('key', Buffer.from('x'), {
          contentType: 'text/plain',
          contentLength: 1,
        }),
      ).rejects.toThrow('S3 network error');
    });
  });

  describe('delete', () => {
    it('sends a DeleteObjectCommand with the configured bucket and key', async () => {
      await driver.delete('uploads/User/42/old.png');

      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'uploads/User/42/old.png',
      });
    });

    it('propagates the raw SDK rejection without translating it', async () => {
      mockS3Send.mockRejectedValueOnce(new Error('S3 delete network error'));

      await expect(driver.delete('key')).rejects.toThrow(
        'S3 delete network error',
      );
    });
  });

  describe('list', () => {
    it('returns an empty array when Contents is absent', async () => {
      mockS3Send.mockResolvedValueOnce({ IsTruncated: false });

      await expect(driver.list('uploads/User/42/')).resolves.toEqual([]);
      expect(ListObjectsV2Command).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'test-bucket',
          Prefix: 'uploads/User/42/',
        }),
      );
    });

    it('follows NextContinuationToken across a truncated response', async () => {
      mockS3Send
        .mockResolvedValueOnce({
          Contents: [{ Key: 'uploads/a' }, { Key: 'uploads/b' }],
          IsTruncated: true,
          NextContinuationToken: 'token-1',
        })
        .mockResolvedValueOnce({
          Contents: [{ Key: 'uploads/c' }],
          IsTruncated: false,
        });

      const keys = await driver.list('uploads/');

      expect(keys).toEqual(['uploads/a', 'uploads/b', 'uploads/c']);
      expect(mockS3Send).toHaveBeenCalledTimes(2);
      expect(ListObjectsV2Command).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          Bucket: 'test-bucket',
          Prefix: 'uploads/',
          ContinuationToken: 'token-1',
        }),
      );
    });

    it('propagates the raw SDK rejection without translating it', async () => {
      mockS3Send.mockRejectedValueOnce(new Error('S3 list network error'));

      await expect(driver.list('uploads/')).rejects.toThrow(
        'S3 list network error',
      );
    });
  });

  describe('url', () => {
    it('joins the key onto a public URL without a trailing slash', () => {
      const driverWithoutSlash = new S3StorageDriver(
        makeConfigService({
          STORAGE_PUBLIC_URL: 'http://localhost:9000/test-bucket',
        }),
      );

      expect(driverWithoutSlash.url('uploads/User/42/fixed-uuid.png')).toBe(
        'http://localhost:9000/test-bucket/uploads/User/42/fixed-uuid.png',
      );
    });

    it('joins the key onto a public URL that has a trailing slash', () => {
      const driverWithSlash = new S3StorageDriver(
        makeConfigService({
          STORAGE_PUBLIC_URL: 'http://localhost:9000/test-bucket/',
        }),
      );

      expect(driverWithSlash.url('uploads/User/42/fixed-uuid.png')).toBe(
        'http://localhost:9000/test-bucket/uploads/User/42/fixed-uuid.png',
      );
    });
  });
});
