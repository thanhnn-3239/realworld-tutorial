import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { ProfilesRepository } from './profiles.repository';
import { ProfilesService } from './profiles.service';

const VIEWER_ID = 1;
const TARGET_ID = 2;

const profileRowNotFollowing = {
  id: TARGET_ID,
  username: 'jake',
  bio: 'I work at statefarm',
  image: null,
  followedBy: [] as { id: number }[],
};

const profileRowFollowing = {
  ...profileRowNotFollowing,
  followedBy: [{ id: VIEWER_ID }],
};

describe('ProfilesService', () => {
  let service: ProfilesService;
  let repository: {
    findByUsername: jest.Mock;
    isFollowing: jest.Mock;
    follow: jest.Mock;
    unfollow: jest.Mock;
  };
  let i18n: { t: jest.Mock };

  beforeEach(() => {
    repository = {
      findByUsername: jest.fn().mockResolvedValue(profileRowNotFollowing),
      isFollowing: jest.fn().mockResolvedValue(false),
      follow: jest.fn().mockResolvedValue({ id: TARGET_ID }),
      unfollow: jest.fn().mockResolvedValue({ id: TARGET_ID }),
    };
    i18n = { t: jest.fn((key: string) => `translated:${key}`) };
    service = new ProfilesService(
      repository as unknown as ProfilesRepository,
      i18n as unknown as I18nService,
    );
  });

  // ── getProfile ─────────────────────────────────────────────────────────

  describe('getProfile', () => {
    it('returns following: false when followedBy is empty', async () => {
      const result = await service.getProfile('jake', VIEWER_ID);
      expect(result).toEqual({
        username: 'jake',
        bio: 'I work at statefarm',
        image: null,
        following: false,
      });
      expect(repository.findByUsername).toHaveBeenCalledWith('jake', VIEWER_ID);
    });

    it('returns following: true when viewer follows the target', async () => {
      repository.findByUsername.mockResolvedValue(profileRowFollowing);
      const result = await service.getProfile('jake', VIEWER_ID);
      expect(result.following).toBe(true);
    });

    it('returns following: false when no viewerId provided', async () => {
      repository.findByUsername.mockResolvedValue(profileRowNotFollowing);
      const result = await service.getProfile('jake');
      expect(result.following).toBe(false);
      expect(repository.findByUsername).toHaveBeenCalledWith('jake', undefined);
    });

    it('throws NotFoundException when the username does not exist', async () => {
      repository.findByUsername.mockResolvedValue(null);
      await expect(service.getProfile('nobody')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('uses the profileNotFound i18n key', async () => {
      repository.findByUsername.mockResolvedValue(null);
      await expect(service.getProfile('nobody')).rejects.toThrow(
        'translated:common.error.profileNotFound',
      );
      expect(i18n.t).toHaveBeenCalledWith('common.error.profileNotFound');
    });
  });

  // ── followUser ─────────────────────────────────────────────────────────

  describe('followUser', () => {
    beforeEach(() => {
      repository.findByUsername.mockResolvedValue(profileRowNotFollowing);
    });

    it('throws NotFoundException when the target does not exist', async () => {
      repository.findByUsername.mockReset();
      repository.findByUsername.mockResolvedValue(null);
      await expect(service.followUser(VIEWER_ID, 'nobody')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws UnprocessableEntityException when following self', async () => {
      repository.findByUsername.mockReset();
      repository.findByUsername.mockResolvedValue({
        ...profileRowNotFollowing,
        id: VIEWER_ID,
      });
      await expect(service.followUser(VIEWER_ID, 'jake')).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(i18n.t).toHaveBeenCalledWith('common.error.followSelf');
    });

    it('returns the current followed profile without mutating when already following', async () => {
      repository.isFollowing.mockResolvedValue(true);

      await expect(service.followUser(VIEWER_ID, 'jake')).resolves.toEqual({
        username: 'jake',
        bio: 'I work at statefarm',
        image: null,
        following: true,
      });
      expect(repository.follow).not.toHaveBeenCalled();
    });

    it('calls repository.follow with correct ids', async () => {
      await service.followUser(VIEWER_ID, 'jake');
      expect(repository.follow).toHaveBeenCalledWith(VIEWER_ID, TARGET_ID);
    });

    it('returns the profile with following: true after follow', async () => {
      const result = await service.followUser(VIEWER_ID, 'jake');
      expect(result).toEqual({
        username: 'jake',
        bio: 'I work at statefarm',
        image: null,
        following: true,
      });
      expect(repository.findByUsername).toHaveBeenCalledTimes(1);
    });
  });

  // ── unfollowUser ───────────────────────────────────────────────────────

  describe('unfollowUser', () => {
    beforeEach(() => {
      repository.isFollowing.mockResolvedValue(true);
      repository.findByUsername.mockResolvedValue(profileRowFollowing);
    });

    it('throws NotFoundException when the target does not exist', async () => {
      repository.findByUsername.mockReset();
      repository.findByUsername.mockResolvedValue(null);
      await expect(service.unfollowUser(VIEWER_ID, 'nobody')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the current unfollowed profile without mutating when not following', async () => {
      repository.findByUsername.mockResolvedValue(profileRowNotFollowing);
      repository.isFollowing.mockResolvedValue(false);

      await expect(service.unfollowUser(VIEWER_ID, 'jake')).resolves.toEqual({
        username: 'jake',
        bio: 'I work at statefarm',
        image: null,
        following: false,
      });
      expect(repository.unfollow).not.toHaveBeenCalled();
    });

    it('calls repository.unfollow with correct ids', async () => {
      await service.unfollowUser(VIEWER_ID, 'jake');
      expect(repository.unfollow).toHaveBeenCalledWith(VIEWER_ID, TARGET_ID);
    });

    it('returns the profile with following: false after unfollow', async () => {
      const result = await service.unfollowUser(VIEWER_ID, 'jake');
      expect(result).toEqual({
        username: 'jake',
        bio: 'I work at statefarm',
        image: null,
        following: false,
      });
      expect(repository.findByUsername).toHaveBeenCalledTimes(1);
    });
  });

  // ── i18n key assertions ────────────────────────────────────────────────
});
