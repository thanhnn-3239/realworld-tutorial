import { AvatarReplacementService } from './avatar-replacement.service';
import { UsersRepository } from './users.repository';
import { PrismaService } from '../prisma/prisma.service';
import { FileStorageService } from '../file-storage/file-storage.service';
import { ImageProcessingService } from '../image-processing/image-processing.service';
import { CustomLoggerService } from '../logger/logger.service';
import type { ProcessedImage } from '../image-processing/interfaces/processed-image.interface';

jest.mock('node:crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('new-uuid'),
}));

const newAvatarKey = 'avatars/1/new-uuid.webp';

const updatedUser = {
  email: 'jake@jake.jake',
  username: 'jake',
  bio: 'bio',
  image: newAvatarKey,
};

const avatarFile = {
  originalname: 'avatar.png',
  mimetype: 'image/png',
  size: 1024,
  buffer: Buffer.from('png-bytes'),
} as Express.Multer.File;

const processed: ProcessedImage = {
  data: new Uint8Array([1, 2, 3]),
  format: 'webp',
  mimeType: 'image/webp',
  extension: 'webp',
  width: 512,
  height: 512,
  size: 3,
};

describe('AvatarReplacementService — processing boundary', () => {
  let service: AvatarReplacementService;
  let repository: { lockImage: jest.Mock; update: jest.Mock };
  let storage: { upload: jest.Mock; delete: jest.Mock };
  let prisma: { $transaction: jest.Mock };
  let imageProcessing: { process: jest.Mock };
  let logger: { error: jest.Mock };

  beforeEach(() => {
    repository = {
      lockImage: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(updatedUser),
    };
    storage = {
      upload: jest.fn().mockResolvedValue(newAvatarKey),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    prisma = {
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn({})),
    };
    imageProcessing = {
      process: jest.fn().mockResolvedValue(processed),
    };
    logger = { error: jest.fn() };

    service = new AvatarReplacementService(
      repository as unknown as UsersRepository,
      prisma as unknown as PrismaService,
      imageProcessing as unknown as ImageProcessingService,
      storage as unknown as FileStorageService,
      logger as unknown as CustomLoggerService,
    );
  });

  it('processes the image before uploading, and uploads before opening the transaction', async () => {
    await service.replace(1, {}, avatarFile);

    expect(imageProcessing.process.mock.invocationCallOrder[0]).toBeLessThan(
      storage.upload.mock.invocationCallOrder[0],
    );
    expect(storage.upload.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.$transaction.mock.invocationCallOrder[0],
    );
  });

  it('processes the raw upload buffer with the avatar profile', async () => {
    await service.replace(1, {}, avatarFile);

    expect(imageProcessing.process).toHaveBeenCalledWith(
      avatarFile.buffer,
      'avatar',
    );
  });

  it('derives the storage key from the processed extension and uploads the processed bytes', async () => {
    await service.replace(1, {}, avatarFile);

    expect(storage.upload).toHaveBeenCalledWith(newAvatarKey, {
      data: processed.data,
      mimeType: 'image/webp',
      size: processed.size,
    });
  });

  it('performs no upload, delete, transaction, or repository update when processing rejects', async () => {
    imageProcessing.process.mockRejectedValue(
      new Error('unprocessable avatar'),
    );

    await expect(service.replace(1, {}, avatarFile)).rejects.toThrow(
      'unprocessable avatar',
    );

    expect(storage.upload).not.toHaveBeenCalled();
    expect(storage.delete).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
  });
});
