import { ConflictException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { I18nService } from 'nestjs-i18n';
import { ArticleSlugService } from './article-slug.service';
import { ArticlesRepository } from './articles.repository';

describe('ArticleSlugService', () => {
  const repository = { findSlugsByBase: jest.fn() };
  const i18n = { t: jest.fn((key: string) => `translated:${key}`) };
  let service: ArticleSlugService;

  beforeEach(() => {
    jest.clearAllMocks();
    repository.findSlugsByBase.mockResolvedValue([]);
    service = new ArticleSlugService(
      repository as unknown as ArticlesRepository,
      i18n as unknown as I18nService,
    );
  });

  it.each([
    ['Hướng dẫn NestJS!', 'huong-dan-nestjs'],
    ['Đường đến Prisma', 'duong-den-prisma'],
    ['  Hello---World  ', 'hello-world'],
    ['你好', 'article'],
  ])('normalizes %s to %s', (title, expected) => {
    expect(service.toBaseSlug(title)).toBe(expected);
  });

  it('allocates the first missing numeric suffix', async () => {
    repository.findSlugsByBase.mockResolvedValue([
      'hello',
      'hello-2',
      'hello-4',
      'hello-world',
    ]);

    await expect(service.createCandidate('Hello')).resolves.toBe('hello-3');
  });

  it('passes the excluded article id to the repository', async () => {
    await service.createCandidate('Hello', 17);

    expect(repository.findSlugsByBase).toHaveBeenCalledWith('hello', 17);
  });

  it('retries only a P2002 slug collision', async () => {
    repository.findSlugsByBase
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(['hello']);
    const collision = new Prisma.PrismaClientKnownRequestError('collision', {
      code: 'P2002',
      clientVersion: '7.2.0',
      meta: { target: ['slug'] },
    });
    const write = jest
      .fn()
      .mockRejectedValueOnce(collision)
      .mockResolvedValueOnce('saved');

    await expect(service.execute('Hello', write)).resolves.toBe('saved');
    expect(write.mock.calls.map(([slug]) => slug)).toEqual([
      'hello',
      'hello-2',
    ]);
  });

  it('rethrows a non-slug Prisma conflict', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('collision', {
      code: 'P2002',
      clientVersion: '7.2.0',
      meta: { target: ['name'] },
    });

    await expect(
      service.execute('Hello', async () => Promise.reject(error)),
    ).rejects.toBe(error);
  });

  it('throws localized ConflictException after retry exhaustion', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('collision', {
      code: 'P2002',
      clientVersion: '7.2.0',
      meta: { target: ['slug'] },
    });
    const write = jest.fn().mockRejectedValue(error);

    await expect(service.execute('Hello', write)).rejects.toThrow(
      ConflictException,
    );
    expect(write).toHaveBeenCalledTimes(3);
    expect(i18n.t).toHaveBeenCalledWith('common.error.articleSlugConflict');
  });
});
