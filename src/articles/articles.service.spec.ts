import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { ArticleResponseMapper } from './article-response.mapper';
import { ArticleSlugService } from './article-slug.service';
import { ArticlesRepository } from './articles.repository';
import { ArticlesService } from './articles.service';

const USER_ID = 7;
const stored = {
  id: 1,
  slug: 'original',
  title: 'Original',
  description: 'Description',
  body: 'Body',
  createdAt: new Date('2026-08-23T00:00:00.000Z'),
  updatedAt: new Date('2026-08-23T00:00:00.000Z'),
  authorId: USER_ID,
  tagList: [{ name: 'nestjs' }],
  author: { username: 'jake', bio: null, image: null },
  _count: { favoritedBy: 0 },
};

async function captureException(
  operation: () => Promise<unknown>,
): Promise<unknown> {
  try {
    await operation();
  } catch (error) {
    return error;
  }

  throw new Error('Expected operation to reject');
}

describe('ArticlesService', () => {
  const repository = {
    create: jest.fn(),
    findBySlug: jest.fn(),
    findIdentityBySlug: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const slugService = { execute: jest.fn() };
  const i18n = { t: jest.fn((key: string) => `translated:${key}`) };
  let service: ArticlesService;

  beforeEach(() => {
    jest.clearAllMocks();
    repository.create.mockResolvedValue(stored);
    repository.findBySlug.mockResolvedValue(stored);
    repository.findIdentityBySlug.mockResolvedValue({
      id: stored.id,
      slug: stored.slug,
      title: stored.title,
      authorId: stored.authorId,
    });
    repository.update.mockResolvedValue(stored);
    repository.delete.mockResolvedValue(undefined);
    slugService.execute.mockImplementation(
      async (_title: string, write: (slug: string) => Promise<unknown>) =>
        write('generated-slug'),
    );
    service = new ArticlesService(
      repository as unknown as ArticlesRepository,
      slugService as unknown as ArticleSlugService,
      new ArticleResponseMapper(),
      i18n as unknown as I18nService,
    );
  });

  describe('create', () => {
    it('normalizes fields and tags while preserving the body', async () => {
      await service.create(USER_ID, {
        title: '  Title  ',
        description: '  Description  ',
        body: ' Body\n',
        tagList: [' NestJS ', 'nestjs', '', '   ', 'PRISMA'],
      });

      expect(repository.create).toHaveBeenCalledWith({
        slug: 'generated-slug',
        title: 'Title',
        description: 'Description',
        body: ' Body\n',
        authorId: USER_ID,
        tags: ['nestjs', 'prisma'],
      });
    });

    it('uses an empty tag list when tagList is omitted', async () => {
      await service.create(USER_ID, {
        title: 'Title',
        description: 'Description',
        body: 'Body',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ tags: [] }),
      );
    });

    it('returns the mapped public article', async () => {
      await expect(
        service.create(USER_ID, {
          title: 'Title',
          description: 'Description',
          body: 'Body',
        }),
      ).resolves.toEqual({
        slug: 'original',
        title: 'Original',
        description: 'Description',
        body: 'Body',
        tagList: ['nestjs'],
        createdAt: stored.createdAt,
        updatedAt: stored.updatedAt,
        favorited: false,
        favoritesCount: 0,
        author: {
          username: 'jake',
          bio: null,
          image: null,
          following: false,
        },
      });
    });
  });

  describe('getBySlug', () => {
    it('returns the mapped article', async () => {
      await expect(service.getBySlug('original')).resolves.toEqual(
        expect.objectContaining({
          slug: 'original',
          tagList: ['nestjs'],
          favorited: false,
          favoritesCount: 0,
        }),
      );
      expect(repository.findBySlug).toHaveBeenCalledWith('original');
    });

    it('throws a localized 404 for a missing article', async () => {
      repository.findBySlug.mockResolvedValue(null);

      const error = await captureException(() => service.getBySlug('missing'));

      expect(error).toBeInstanceOf(NotFoundException);
      expect(error).toHaveProperty(
        'message',
        'translated:common.error.articleNotFound',
      );
      expect(i18n.t).toHaveBeenCalledWith('common.error.articleNotFound');
    });
  });

  describe('update', () => {
    it('rejects an empty effective update with a localized 422', async () => {
      const error = await captureException(() =>
        service.update(USER_ID, 'original', {}),
      );

      expect(error).toBeInstanceOf(UnprocessableEntityException);
      expect(error).toHaveProperty(
        'message',
        'translated:common.error.emptyArticleUpdate',
      );
      expect(i18n.t).toHaveBeenCalledWith('common.error.emptyArticleUpdate');
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('returns localized 404 before validating an empty update for a missing article', async () => {
      repository.findIdentityBySlug.mockResolvedValue(null);

      const error = await captureException(() =>
        service.update(USER_ID, 'missing', {}),
      );

      expect(error).toBeInstanceOf(NotFoundException);
      expect(error).not.toBeInstanceOf(UnprocessableEntityException);
      expect(error).toHaveProperty(
        'message',
        'translated:common.error.articleNotFound',
      );
      expect(i18n.t).toHaveBeenCalledWith('common.error.articleNotFound');
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('returns localized 403 before validating an empty update for a non-author', async () => {
      const error = await captureException(() =>
        service.update(99, 'original', {}),
      );

      expect(error).toBeInstanceOf(ForbiddenException);
      expect(error).not.toBeInstanceOf(UnprocessableEntityException);
      expect(error).toHaveProperty(
        'message',
        'translated:common.error.articleForbidden',
      );
      expect(i18n.t).toHaveBeenCalledWith('common.error.articleForbidden');
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('returns 404 when the target article is missing', async () => {
      repository.findIdentityBySlug.mockResolvedValue(null);

      await expect(
        service.update(USER_ID, 'missing', { title: 'New' }),
      ).rejects.toThrow(NotFoundException);
      expect(i18n.t).toHaveBeenCalledWith('common.error.articleNotFound');
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('rejects a non-author with a localized 403', async () => {
      const error = await captureException(() =>
        service.update(99, 'original', { title: 'New' }),
      );

      expect(error).toBeInstanceOf(ForbiddenException);
      expect(error).toHaveProperty(
        'message',
        'translated:common.error.articleForbidden',
      );
      expect(i18n.t).toHaveBeenCalledWith('common.error.articleForbidden');
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('trims description and preserves body whitespace', async () => {
      await service.update(USER_ID, 'original', {
        description: '  Updated description  ',
        body: ' Updated body\n',
      });

      expect(repository.update).toHaveBeenCalledWith(stored.id, {
        description: 'Updated description',
        body: ' Updated body\n',
      });
    });

    it('preserves tags when tagList is omitted', async () => {
      await service.update(USER_ID, 'original', { body: 'Updated' });

      expect(repository.update).toHaveBeenCalledWith(stored.id, {
        body: 'Updated',
      });
      expect(repository.update.mock.calls[0][1]).not.toHaveProperty('tags');
    });

    it('clears all tag links when tagList is empty', async () => {
      await service.update(USER_ID, 'original', { tagList: [] });

      expect(repository.update).toHaveBeenCalledWith(stored.id, { tags: [] });
    });

    it('normalizes and replaces a non-empty tag list', async () => {
      await service.update(USER_ID, 'original', {
        tagList: [' NestJS ', 'nestjs', '', 'PRISMA'],
      });

      expect(repository.update).toHaveBeenCalledWith(stored.id, {
        tags: ['nestjs', 'prisma'],
      });
    });

    it('treats tags that normalize to empty as clearing all tag links', async () => {
      await service.update(USER_ID, 'original', { tagList: ['', '   '] });

      expect(repository.update).toHaveBeenCalledWith(stored.id, { tags: [] });
    });

    it('regenerates the slug when the trimmed title changes', async () => {
      await service.update(USER_ID, 'original', { title: ' New title ' });

      expect(slugService.execute).toHaveBeenCalledWith(
        'New title',
        expect.any(Function),
        stored.id,
      );
      expect(repository.update).toHaveBeenCalledWith(stored.id, {
        title: 'New title',
        slug: 'generated-slug',
      });
    });

    it('does not regenerate the slug when trimming leaves the title unchanged', async () => {
      await service.update(USER_ID, 'original', { title: '  Original  ' });

      expect(slugService.execute).not.toHaveBeenCalled();
      expect(repository.update).toHaveBeenCalledWith(stored.id, {
        title: 'Original',
      });
    });

    it('returns the mapped updated article', async () => {
      repository.update.mockResolvedValue({
        ...stored,
        description: 'Updated description',
      });

      await expect(
        service.update(USER_ID, 'original', {
          description: 'Updated description',
        }),
      ).resolves.toEqual(
        expect.objectContaining({ description: 'Updated description' }),
      );
    });
  });

  describe('remove', () => {
    it('returns 404 when the target article is missing', async () => {
      repository.findIdentityBySlug.mockResolvedValue(null);

      await expect(service.remove(USER_ID, 'missing')).rejects.toThrow(
        NotFoundException,
      );
      expect(i18n.t).toHaveBeenCalledWith('common.error.articleNotFound');
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('rejects a non-author with a localized 403', async () => {
      const error = await captureException(() =>
        service.remove(99, 'original'),
      );

      expect(error).toBeInstanceOf(ForbiddenException);
      expect(error).toHaveProperty(
        'message',
        'translated:common.error.articleForbidden',
      );
      expect(i18n.t).toHaveBeenCalledWith('common.error.articleForbidden');
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('deletes an owned article and returns null', async () => {
      await expect(service.remove(USER_ID, 'original')).resolves.toBeNull();
      expect(repository.delete).toHaveBeenCalledWith(stored.id);
    });
  });
});
