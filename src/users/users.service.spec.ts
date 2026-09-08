import { ConflictException, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';

const USER_ID = 1;

const storedUser = {
  id: USER_ID,
  email: 'jake@jake.jake',
  username: 'jake',
  bio: 'I work at statefarm',
  image: null,
};

describe('UsersService', () => {
  let service: UsersService;
  // Loose mock types: the repository's `Prisma.UserSelect` annotation widens
  // its inferred row type to every column, which fixtures need not satisfy.
  let i18n: { t: jest.Mock };
  let repository: {
    findById: jest.Mock;
    update: jest.Mock;
    findByUsernameExcluding: jest.Mock;
  };

  beforeEach(() => {
    repository = {
      findById: jest.fn().mockResolvedValue(storedUser),
      update: jest.fn().mockResolvedValue(storedUser),
      findByUsernameExcluding: jest.fn().mockResolvedValue(null),
    };

    // nestjs-i18n resolves the request language itself and falls back to
    // `fallbackLanguage`, so the service only has to pass the right key.
    i18n = { t: jest.fn((key: string) => `translated:${key}`) };

    service = new UsersService(
      repository as unknown as UsersRepository,
      i18n as unknown as I18nService,
    );
  });

  describe('getCurrentUser', () => {
    it('returns only the public profile fields', async () => {
      await expect(service.getCurrentUser(USER_ID)).resolves.toEqual({
        email: 'jake@jake.jake',
        username: 'jake',
        bio: 'I work at statefarm',
        image: null,
      });
    });

    it('throws NotFoundException when the user does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.getCurrentUser(USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateUser - uniqueness', () => {
    it('rejects a username already used by another user', async () => {
      repository.findByUsernameExcluding.mockResolvedValue({ id: 2 });

      await expect(
        service.updateUser(USER_ID, { username: 'taken' }),
      ).rejects.toThrow(ConflictException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('does not run uniqueness checks for fields that were not sent', async () => {
      await service.updateUser(USER_ID, { bio: 'new bio' });

      expect(repository.findByUsernameExcluding).not.toHaveBeenCalled();
    });
  });

  describe('localized error messages', () => {
    it('asks i18n for the "user not found" key', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.getCurrentUser(USER_ID)).rejects.toThrow(
        'translated:common.error.userNotFound',
      );
      expect(i18n.t).toHaveBeenCalledWith('common.error.userNotFound');
    });

    it('asks i18n for the username conflict key', async () => {
      repository.findByUsernameExcluding.mockResolvedValue({ id: 2 });

      await expect(
        service.updateUser(USER_ID, { username: 'taken' }),
      ).rejects.toThrow('translated:common.error.usernameInUse');
      expect(i18n.t).toHaveBeenCalledWith('common.error.usernameInUse');
    });

    it('hardcodes no English message of its own', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.getCurrentUser(USER_ID)).rejects.not.toThrow(
        'User not found',
      );
    });
  });

  describe('updateUser - response', () => {
    it('returns only the public profile fields', async () => {
      repository.update.mockResolvedValue({
        ...storedUser,
        bio: 'I like to skateboard',
      });

      await expect(
        service.updateUser(USER_ID, { bio: 'I like to skateboard' }),
      ).resolves.toEqual({
        email: 'jake@jake.jake',
        username: 'jake',
        bio: 'I like to skateboard',
        image: null,
      });
    });
  });
});
