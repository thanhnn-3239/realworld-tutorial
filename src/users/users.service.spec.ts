import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { I18nService } from 'nestjs-i18n';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { PasswordService } from '../common/password/password.service';

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
    findByEmailExcluding: jest.Mock;
    findByUsernameExcluding: jest.Mock;
  };

  beforeEach(() => {
    repository = {
      findById: jest.fn().mockResolvedValue(storedUser),
      update: jest.fn().mockResolvedValue(storedUser),
      findByEmailExcluding: jest.fn().mockResolvedValue(null),
      findByUsernameExcluding: jest.fn().mockResolvedValue(null),
    };

    // Real hashing with cheap rounds, so assertions verify actual bcrypt output.
    const configService = {
      get: jest.fn(() => '4'),
    } as unknown as ConfigService;

    // nestjs-i18n resolves the request language itself and falls back to
    // `fallbackLanguage`, so the service only has to pass the right key.
    i18n = { t: jest.fn((key: string) => `translated:${key}`) };

    service = new UsersService(
      repository as unknown as UsersRepository,
      new PasswordService(configService),
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
    it('rejects an email already used by another user', async () => {
      repository.findByEmailExcluding.mockResolvedValue({ id: 2 });

      await expect(
        service.updateUser(USER_ID, { email: 'taken@example.com' }),
      ).rejects.toThrow(ConflictException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('rejects a username already used by another user', async () => {
      repository.findByUsernameExcluding.mockResolvedValue({ id: 2 });

      await expect(
        service.updateUser(USER_ID, { username: 'taken' }),
      ).rejects.toThrow(ConflictException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('does not run uniqueness checks for fields that were not sent', async () => {
      await service.updateUser(USER_ID, { bio: 'new bio' });

      expect(repository.findByEmailExcluding).not.toHaveBeenCalled();
      expect(repository.findByUsernameExcluding).not.toHaveBeenCalled();
    });
  });

  describe('updateUser - password', () => {
    it('hashes the password instead of storing the plaintext', async () => {
      await service.updateUser(USER_ID, { password: 'new-password' });

      const [, data] = repository.update.mock.calls[0];
      expect(data.password).toBeDefined();
      expect(data.password).not.toBe('new-password');
      expect(data.password).toMatch(/^\$2[aby]\$/);
    });

    it('stores a hash that verifies against the new password', async () => {
      await service.updateUser(USER_ID, { password: 'new-password' });

      const [, data] = repository.update.mock.calls[0];
      await expect(
        bcrypt.compare('new-password', data.password as string),
      ).resolves.toBe(true);
    });

    it('stores a hash that rejects the previous password', async () => {
      await service.updateUser(USER_ID, { password: 'new-password' });

      const [, data] = repository.update.mock.calls[0];
      await expect(
        bcrypt.compare('old-password', data.password as string),
      ).resolves.toBe(false);
    });

    it('omits the password column when no password was sent', async () => {
      await service.updateUser(USER_ID, { bio: 'new bio' });

      const [, data] = repository.update.mock.calls[0];
      expect(data).not.toHaveProperty('password');
    });

    it('updates the password alongside profile fields', async () => {
      await service.updateUser(USER_ID, {
        username: 'newusername',
        password: 'new-password',
      });

      const [id, data] = repository.update.mock.calls[0];
      expect(id).toBe(USER_ID);
      expect(data.username).toBe('newusername');
      await expect(
        bcrypt.compare('new-password', data.password as string),
      ).resolves.toBe(true);
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

    it('asks i18n for the email conflict key', async () => {
      repository.findByEmailExcluding.mockResolvedValue({ id: 2 });

      await expect(
        service.updateUser(USER_ID, { email: 'taken@example.com' }),
      ).rejects.toThrow('translated:common.error.emailInUse');
      expect(i18n.t).toHaveBeenCalledWith('common.error.emailInUse');
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
