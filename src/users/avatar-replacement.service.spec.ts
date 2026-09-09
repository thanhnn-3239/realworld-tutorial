import { BadGatewayException } from '@nestjs/common';
import { AvatarReplacementService } from './avatar-replacement.service';
import { UsersRepository } from './users.repository';
import { PrismaService } from '../prisma/prisma.service';
import { FileStorageService } from '../file-storage/file-storage.service';
import { CustomLoggerService } from '../logger/logger.service';

jest.mock('node:crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('new-uuid'),
}));

const newAvatarKey = 'avatars/1/new-uuid.png';
const oldAvatarKey = 'avatars/1/old.png';

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

describe('AvatarReplacementService', () => {
  let service: AvatarReplacementService;
  let repository: { lockImage: jest.Mock; update: jest.Mock };
  let storage: { upload: jest.Mock; delete: jest.Mock };
  let prisma: { $transaction: jest.Mock };
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
    logger = { error: jest.fn() };

    service = new AvatarReplacementService(
      repository as unknown as UsersRepository,
      prisma as unknown as PrismaService,
      storage as unknown as FileStorageService,
      logger as unknown as CustomLoggerService,
    );
  });

  it('stores the key and deletes the object it replaced', async () => {
    repository.lockImage.mockResolvedValue(oldAvatarKey);

    await service.replace(1, { bio: 'x' }, avatarFile);

    expect(storage.upload).toHaveBeenCalledWith(newAvatarKey, avatarFile);
    expect(repository.update).toHaveBeenCalledWith(
      1,
      { bio: 'x', image: newAvatarKey },
      expect.anything(),
    );
    expect(storage.delete).toHaveBeenCalledWith(oldAvatarKey);
    // Asserting only the old key would still pass if the replacement were
    // deleted alongside it, which is exactly what this case exists to catch.
    expect(storage.delete).not.toHaveBeenCalledWith(newAvatarKey);
  });

  it('deletes nothing when the user had no avatar', async () => {
    repository.lockImage.mockResolvedValue(null);

    await service.replace(1, {}, avatarFile);

    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('deletes the new object when the transaction fails', async () => {
    prisma.$transaction.mockRejectedValue(new Error('db down'));

    await expect(service.replace(1, {}, avatarFile)).rejects.toThrow('db down');
    expect(storage.delete).toHaveBeenCalledWith(newAvatarKey);
  });

  it('keeps the update successful when reclaiming the old object fails', async () => {
    repository.lockImage.mockResolvedValue(oldAvatarKey);
    storage.delete.mockRejectedValue(
      new BadGatewayException('File deletion failed'),
    );

    await expect(service.replace(1, {}, avatarFile)).resolves.toBeDefined();
    // FileStorageService.delete already logged the underlying cause, so this
    // entry carries only the key and its context — no wrapper message, no stack.
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(oldAvatarKey),
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.not.stringContaining('File deletion failed'),
    );
  });

  it('uploads before the transaction and locks before overwriting the key', async () => {
    await service.replace(1, {}, avatarFile);

    expect(storage.upload.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.$transaction.mock.invocationCallOrder[0],
    );
    expect(repository.lockImage.mock.invocationCallOrder[0]).toBeLessThan(
      repository.update.mock.invocationCallOrder[0],
    );
  });

  it('reclaims the superseded object only after the transaction resolves', async () => {
    repository.lockImage.mockResolvedValue(oldAvatarKey);
    let transactionSettled = false;
    prisma.$transaction.mockImplementation(
      async (fn: (tx: unknown) => unknown) => {
        const value = await fn({});
        transactionSettled = true;
        return value;
      },
    );
    storage.delete.mockImplementation(() => {
      expect(transactionSettled).toBe(true);
      return Promise.resolve();
    });

    await service.replace(1, {}, avatarFile);

    expect(storage.delete).toHaveBeenCalledWith(oldAvatarKey);
  });

  it('never opens the transaction when the upload fails', async () => {
    storage.upload.mockRejectedValue(new Error('S3 unavailable'));

    await expect(service.replace(1, {}, avatarFile)).rejects.toThrow(
      'S3 unavailable',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('keeps the database error when compensating for it also fails', async () => {
    prisma.$transaction.mockRejectedValue(new Error('deadlock detected'));
    storage.delete.mockRejectedValue(
      new BadGatewayException('File deletion failed'),
    );

    await expect(service.replace(1, {}, avatarFile)).rejects.toThrow(
      'deadlock detected',
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(newAvatarKey),
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('deadlock detected'),
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.not.stringContaining('File deletion failed'),
    );
  });

  it('deletes the stored object when the avatar is cleared', async () => {
    repository.lockImage.mockResolvedValue(oldAvatarKey);

    await service.clear(1, { bio: 'no avatar' });

    expect(repository.update).toHaveBeenCalledWith(
      1,
      { bio: 'no avatar', image: null },
      expect.anything(),
    );
    expect(storage.delete).toHaveBeenCalledWith(oldAvatarKey);
    expect(storage.upload).not.toHaveBeenCalled();
  });
});
