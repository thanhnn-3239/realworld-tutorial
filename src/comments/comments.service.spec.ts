import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { ArticlesRepository } from '../articles/articles.repository';
import { CommentResponseMapper } from './comment-response.mapper';
import { CommentsRepository } from './comments.repository';
import { CommentsService } from './comments.service';

describe('CommentsService', () => {
  const articlesRepository = {
    findIdentityBySlug: jest.fn(),
  };
  const commentsRepository = {
    listByArticleId: jest.fn(),
    create: jest.fn(),
    findIdentity: jest.fn(),
    delete: jest.fn(),
  };
  const responseMapper = {
    toResponse: jest.fn(),
    toResponseList: jest.fn(),
  };
  const i18n = {
    t: jest.fn((key: string) => key),
  };

  let service: CommentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CommentsService(
      articlesRepository as unknown as ArticlesRepository,
      commentsRepository as unknown as CommentsRepository,
      responseMapper as unknown as CommentResponseMapper,
      i18n as unknown as I18nService,
    );
  });

  describe('list', () => {
    it('throws NotFoundException when article is missing', async () => {
      articlesRepository.findIdentityBySlug.mockResolvedValue(null);

      await expect(service.list('missing-slug', 1)).rejects.toThrow(
        NotFoundException,
      );
      expect(i18n.t).toHaveBeenCalledWith('common.error.articleNotFound');
    });

    it('passes article.id and viewerId to repository and returns mapped list', async () => {
      articlesRepository.findIdentityBySlug.mockResolvedValue({ id: 10 });
      const rawComments = [{ id: 1, body: 'Hello' }];
      const mappedComments = [
        { id: 1, body: 'Hello', author: { following: true } },
      ];
      commentsRepository.listByArticleId.mockResolvedValue(rawComments);
      responseMapper.toResponseList.mockReturnValue(mappedComments);

      const result = await service.list('valid-slug', 42);

      expect(articlesRepository.findIdentityBySlug).toHaveBeenCalledWith(
        'valid-slug',
      );
      expect(commentsRepository.listByArticleId).toHaveBeenCalledWith(10, 42);
      expect(responseMapper.toResponseList).toHaveBeenCalledWith(rawComments);
      expect(result).toBe(mappedComments);
    });

    it('passes undefined viewerId when not authenticated', async () => {
      articlesRepository.findIdentityBySlug.mockResolvedValue({ id: 10 });
      commentsRepository.listByArticleId.mockResolvedValue([]);
      responseMapper.toResponseList.mockReturnValue([]);

      const result = await service.list('valid-slug');

      expect(commentsRepository.listByArticleId).toHaveBeenCalledWith(
        10,
        undefined,
      );
      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    it('creates comment and returns mapped response', async () => {
      articlesRepository.findIdentityBySlug.mockResolvedValue({ id: 10 });
      const rawComment = { id: 1, body: 'New comment' };
      const mappedComment = { id: 1, body: 'New comment' };
      commentsRepository.create.mockResolvedValue(rawComment);
      responseMapper.toResponse.mockReturnValue(mappedComment);

      const result = await service.create(5, 'valid-slug', {
        body: 'New comment',
      });

      expect(commentsRepository.create).toHaveBeenCalledWith(
        10,
        5,
        'New comment',
      );
      expect(responseMapper.toResponse).toHaveBeenCalledWith(rawComment);
      expect(result).toBe(mappedComment);
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when comment is not found', async () => {
      articlesRepository.findIdentityBySlug.mockResolvedValue({ id: 10 });
      commentsRepository.findIdentity.mockResolvedValue(null);

      await expect(service.remove(5, 'valid-slug', 99)).rejects.toThrow(
        NotFoundException,
      );
      expect(i18n.t).toHaveBeenCalledWith('common.error.commentNotFound');
    });

    it('throws ForbiddenException when user is not comment author', async () => {
      articlesRepository.findIdentityBySlug.mockResolvedValue({ id: 10 });
      commentsRepository.findIdentity.mockResolvedValue({
        id: 99,
        authorId: 6,
      });

      await expect(service.remove(5, 'valid-slug', 99)).rejects.toThrow(
        ForbiddenException,
      );
      expect(i18n.t).toHaveBeenCalledWith('common.error.commentForbidden');
    });

    it('deletes comment when user is author', async () => {
      articlesRepository.findIdentityBySlug.mockResolvedValue({ id: 10 });
      commentsRepository.findIdentity.mockResolvedValue({
        id: 99,
        authorId: 5,
      });
      commentsRepository.delete.mockResolvedValue(undefined);

      const result = await service.remove(5, 'valid-slug', 99);

      expect(commentsRepository.delete).toHaveBeenCalledWith(99);
      expect(result).toBeNull();
    });
  });
});
