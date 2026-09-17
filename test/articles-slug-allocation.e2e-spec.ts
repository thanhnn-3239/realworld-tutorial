import { ConflictException, HttpStatus } from '@nestjs/common';

import { ArticleSlugService } from '../src/articles/article-slug.service';
import { createArticleViaApi } from './support/article-test-helpers';
import { useE2eSuite } from './support/e2e-suite';

describe('Article slug allocation (e2e)', () => {
  const e2e = useE2eSuite('articles-slug-allocation');

  it('allocates deterministic numeric suffixes for duplicate titles', async () => {
    const owner = await e2e.fixtures.authenticatedUser();

    const first = await createArticleViaApi(
      e2e,
      owner.authorization,
      'Duplicate Runtime',
    );
    const second = await createArticleViaApi(
      e2e,
      owner.authorization,
      'Duplicate Runtime',
    );
    const third = await createArticleViaApi(
      e2e,
      owner.authorization,
      'Duplicate Runtime',
    );

    expect(first.body.data.slug).toBe('duplicate-runtime');
    expect(second.body.data.slug).toBe('duplicate-runtime-2');
    expect(third.body.data.slug).toBe('duplicate-runtime-3');
  });

  it('maps a localized slug conflict to the exact 409 envelope', async () => {
    const owner = await e2e.fixtures.authenticatedUser();
    const slugService = e2e.resolve<ArticleSlugService>(ArticleSlugService);
    const executeSpy = jest
      .spyOn(slugService, 'execute')
      .mockRejectedValueOnce(
        new ConflictException('Could not allocate a unique article slug'),
      );

    try {
      await e2e.request
        .post('/v1/articles')
        .set('Authorization', owner.authorization)
        .send({
          title: 'HTTP Conflict',
          description: 'Description',
          body: 'Body',
        })
        .expect(HttpStatus.CONFLICT)
        .expect(({ body }) => {
          expect(body).toEqual({
            statusCode: HttpStatus.CONFLICT,
            message: 'Could not allocate a unique article slug',
          });
        });

      expect(executeSpy).toHaveBeenCalledTimes(1);
      await expect(
        e2e.prisma.article.count({ where: { title: 'HTTP Conflict' } }),
      ).resolves.toBe(0);
    } finally {
      executeSpy.mockRestore();
    }
  });
});
