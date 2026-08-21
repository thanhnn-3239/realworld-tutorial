import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
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

    service = new UsersService(
      repository as unknown as UsersRepository,
      new PasswordService(configService),
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
