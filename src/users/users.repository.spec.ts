import { UsersRepository } from './users.repository';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersRepository', () => {
  let repository: UsersRepository;
  let mockPrisma: {
    user: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    $queryRaw: jest.Mock;
  };

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };
    repository = new UsersRepository(mockPrisma as unknown as PrismaService);
  });

  describe('findById', () => {
    it('finds user by id with publicUserSelect', async () => {
      const expectedUser = {
        id: 1,
        email: 'user@example.com',
        username: 'user1',
        bio: null,
        image: null,
      };
      mockPrisma.user.findUnique.mockResolvedValue(expectedUser);

      const result = await repository.findById(1);

      expect(result).toEqual(expectedUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: {
          id: true,
          email: true,
          username: true,
          bio: true,
          image: true,
        },
      });
    });
  });

  describe('update', () => {
    it('updates user with default prisma client', async () => {
      const updatedUser = {
        id: 1,
        email: 'user@example.com',
        username: 'user1-updated',
        bio: 'bio',
        image: null,
      };
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      const result = await repository.update(1, { bio: 'bio' });

      expect(result).toEqual(updatedUser);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { bio: 'bio' },
        select: {
          id: true,
          email: true,
          username: true,
          bio: true,
          image: true,
        },
      });
    });

    it('updates user using transaction client when provided', async () => {
      const txClient = {
        user: { update: jest.fn().mockResolvedValue({ id: 2 }) },
      };

      await repository.update(2, { bio: 'new' }, txClient as any);

      expect(txClient.user.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { bio: 'new' },
        select: {
          id: true,
          email: true,
          username: true,
          bio: true,
          image: true,
        },
      });
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('lockImage', () => {
    it('returns image when row is found', async () => {
      const txClient = {
        $queryRaw: jest.fn().mockResolvedValue([{ image: 'avatar.png' }]),
      };

      const result = await repository.lockImage(1, txClient as any);

      expect(result).toBe('avatar.png');
    });

    it('returns null when row is not found or image is null', async () => {
      const txClient = {
        $queryRaw: jest.fn().mockResolvedValue([]),
      };

      const result = await repository.lockImage(1, txClient as any);

      expect(result).toBeNull();
    });
  });

  describe('findByUsernameExcluding', () => {
    it('finds existing user with same username excluding given id', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 2 });

      const result = await repository.findByUsernameExcluding('taken', 1);

      expect(result).toEqual({ id: 2 });
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          username: 'taken',
          NOT: { id: 1 },
        },
        select: { id: true },
      });
    });
  });

  describe('findFollowersByAuthorId', () => {
    it('queries followers with id, email, and username', async () => {
      const followers = [
        { id: 2, email: 'follower@example.com', username: 'follower' },
      ];
      mockPrisma.user.findMany.mockResolvedValue(followers);

      const result = await repository.findFollowersByAuthorId(10);

      expect(result).toEqual(followers);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { following: { some: { id: 10 } } },
        select: { id: true, email: true, username: true },
      });
    });
  });
});
