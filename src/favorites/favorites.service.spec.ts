import { NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { ArticleResponseMapper } from '../articles/article-response.mapper';
import { ArticlesRepository } from '../articles/articles.repository';
import { Prisma } from '../generated/prisma/client';
import { ArticleEventProducer } from '../kafka/producers/article-event.producer';
import { FavoritesRepository } from './favorites.repository';
import { FavoritesService } from './favorites.service';
import {
  favorited,
  notFavorited,
  USER_ID,
} from './testing/favorites-test-fixtures';

describe('FavoritesService', () => {
  const articlesRepository = {
    findBySlug: jest.fn(),
  };
  const favoritesRepository = {
    connect: jest.fn(),
    disconnect: jest.fn(),
  };
  const responseMapper = {
    toResponse: jest.fn((article: unknown) => article),
  };
  const i18n = {
    t: jest.fn((key: string) => `translated:${key}`),
  };
  const eventProducer = {
    emitArticleFavorited: jest.fn(),
  };

  let service: FavoritesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FavoritesService(
      articlesRepository as unknown as ArticlesRepository,
      favoritesRepository as unknown as FavoritesRepository,
      responseMapper as unknown as ArticleResponseMapper,
      i18n as unknown as I18nService,
      eventProducer as unknown as ArticleEventProducer,
    );
  });

  describe('favorite', () => {
    it('throws a localized NotFoundException for an unknown slug', async () => {
      articlesRepository.findBySlug.mockResolvedValue(null);

      await expect(service.favorite(USER_ID, 'missing')).rejects.toThrow(
        NotFoundException,
      );
      expect(i18n.t).toHaveBeenCalledWith('common.error.articleNotFound');
      expect(favoritesRepository.connect).not.toHaveBeenCalled();
    });

    it('reads the article scoped to the acting user', async () => {
      articlesRepository.findBySlug.mockResolvedValue(notFavorited);
      favoritesRepository.connect.mockResolvedValue(favorited);

      await service.favorite(USER_ID, 'hello');

      expect(articlesRepository.findBySlug).toHaveBeenCalledWith(
        'hello',
        USER_ID,
      );
    });

    it('connects and returns the post-mutation record when not yet favorited', async () => {
      articlesRepository.findBySlug.mockResolvedValue(notFavorited);
      favoritesRepository.connect.mockResolvedValue(favorited);

      const result = await service.favorite(USER_ID, 'hello');

      expect(favoritesRepository.connect).toHaveBeenCalledWith(
        'hello',
        USER_ID,
      );
      expect(responseMapper.toResponse).toHaveBeenCalledWith(favorited);
      expect(result).toBe(favorited);
    });

    it('skips the write and returns the current record when already favorited', async () => {
      articlesRepository.findBySlug.mockResolvedValue(favorited);

      const result = await service.favorite(USER_ID, 'hello');

      expect(favoritesRepository.connect).not.toHaveBeenCalled();
      expect(responseMapper.toResponse).toHaveBeenCalledWith(favorited);
      expect(result).toBe(favorited);
    });

    it('permits favoriting your own article', async () => {
      articlesRepository.findBySlug.mockResolvedValue({
        ...notFavorited,
        authorId: USER_ID,
      });
      favoritesRepository.connect.mockResolvedValue(favorited);

      await expect(service.favorite(USER_ID, 'hello')).resolves.toBe(favorited);
      expect(favoritesRepository.connect).toHaveBeenCalledTimes(1);
    });

    it('recovers from a concurrent P2002 by re-reading the article', async () => {
      const collision = new Prisma.PrismaClientKnownRequestError('collision', {
        code: 'P2002',
        clientVersion: '7.2.0',
        meta: { target: ['A', 'B'] },
      });
      articlesRepository.findBySlug
        .mockResolvedValueOnce(notFavorited)
        .mockResolvedValueOnce(favorited);
      favoritesRepository.connect.mockRejectedValueOnce(collision);

      const result = await service.favorite(USER_ID, 'hello');

      expect(result).toBe(favorited);
      expect(articlesRepository.findBySlug).toHaveBeenCalledTimes(2);
    });

    it('rethrows a Prisma error that is not a P2002 collision', async () => {
      const failure = new Prisma.PrismaClientKnownRequestError('gone', {
        code: 'P2025',
        clientVersion: '7.2.0',
      });
      articlesRepository.findBySlug.mockResolvedValue(notFavorited);
      favoritesRepository.connect.mockRejectedValueOnce(failure);

      await expect(service.favorite(USER_ID, 'hello')).rejects.toBe(failure);
    });

    it('emits article.favorited event with user info, falling back to user-{id}', async () => {
      articlesRepository.findBySlug.mockResolvedValue(notFavorited);
      favoritesRepository.connect.mockResolvedValue(favorited);

      await service.favorite(USER_ID, 'hello', 'jake');
      expect(eventProducer.emitArticleFavorited).toHaveBeenCalledWith({
        articleId: 1,
        slug: 'hello',
        title: 'Hello',
        authorId: 42,
        favoritedByUserId: USER_ID,
        favoritedByUsername: 'jake',
        occurredAt: expect.any(String),
      });

      await service.favorite(USER_ID, 'hello');
      expect(eventProducer.emitArticleFavorited).toHaveBeenLastCalledWith(
        expect.objectContaining({ favoritedByUsername: `user-${USER_ID}` }),
      );
    });

    it('does not emit article.favorited on idempotent favorite', async () => {
      articlesRepository.findBySlug.mockResolvedValue(favorited);

      await service.favorite(USER_ID, 'hello', 'jake');
      expect(eventProducer.emitArticleFavorited).not.toHaveBeenCalled();
    });
  });

  describe('unfavorite', () => {
    it('throws a localized NotFoundException for an unknown slug', async () => {
      articlesRepository.findBySlug.mockResolvedValue(null);

      await expect(service.unfavorite(USER_ID, 'missing')).rejects.toThrow(
        NotFoundException,
      );
      expect(i18n.t).toHaveBeenCalledWith('common.error.articleNotFound');
      expect(favoritesRepository.disconnect).not.toHaveBeenCalled();
    });

    it('disconnects and returns the post-mutation record when favorited', async () => {
      articlesRepository.findBySlug.mockResolvedValue(favorited);
      favoritesRepository.disconnect.mockResolvedValue(notFavorited);

      const result = await service.unfavorite(USER_ID, 'hello');

      expect(favoritesRepository.disconnect).toHaveBeenCalledWith(
        'hello',
        USER_ID,
      );
      expect(result).toBe(notFavorited);
    });

    it('skips the write and returns the current record when not favorited', async () => {
      articlesRepository.findBySlug.mockResolvedValue(notFavorited);

      const result = await service.unfavorite(USER_ID, 'hello');

      expect(favoritesRepository.disconnect).not.toHaveBeenCalled();
      expect(result).toBe(notFavorited);
    });
  });
});
