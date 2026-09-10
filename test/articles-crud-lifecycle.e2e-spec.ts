import { HttpStatus } from '@nestjs/common';

import { createArticleViaApi } from './support/article-test-helpers';
import { useE2eSuite } from './support/e2e-suite';

describe('Article CRUD lifecycle (e2e)', () => {
  const e2e = useE2eSuite('articles-crud-lifecycle');

  it('creates, reads, updates tag variants and title, then deletes an owned article', async () => {
    const owner = await e2e.fixtures.authenticatedUser({
      username: 'article_owner',
    });
    const created = await createArticleViaApi(
      e2e,
      owner.authorization,
      'Hướng dẫn NestJS',
      {
        description: ' Description ',
        body: 'Body\n',
        tagList: [' NESTJS ', 'nestjs', '', 'PRISMA'],
      },
    );

    expect(created.body).toMatchObject({
      statusCode: HttpStatus.CREATED,
      message: 'Article created successfully',
      data: {
        slug: 'huong-dan-nestjs',
        title: 'Hướng dẫn NestJS',
        description: 'Description',
        body: 'Body\n',
        tagList: ['nestjs', 'prisma'],
        favorited: false,
        favoritesCount: 0,
        author: {
          username: owner.username,
          bio: null,
          following: false,
        },
      },
    });
    expect(Object.keys(created.body.data).sort()).toEqual(
      [
        'author',
        'body',
        'createdAt',
        'description',
        'favorited',
        'favoritesCount',
        'slug',
        'tagList',
        'title',
        'updatedAt',
      ].sort(),
    );
    expect(Object.keys(created.body.data.author).sort()).toEqual(
      ['bio', 'following', 'image', 'username'].sort(),
    );
    expect(
      created.body.data.author.image === null ||
        typeof created.body.data.author.image === 'string',
    ).toBe(true);
    expect(new Date(created.body.data.createdAt).toISOString()).toBe(
      created.body.data.createdAt,
    );
    expect(new Date(created.body.data.updatedAt).toISOString()).toBe(
      created.body.data.updatedAt,
    );

    const fetched = await e2e.request
      .get('/v1/articles/huong-dan-nestjs')
      .expect(HttpStatus.OK);
    expect(fetched.body).toMatchObject({
      statusCode: HttpStatus.OK,
      message: 'Article retrieved successfully',
      data: created.body.data,
    });

    const preserved = await e2e.request
      .put('/v1/articles/huong-dan-nestjs')
      .set('Authorization', owner.authorization)
      .send({ body: 'Body changed' })
      .expect(HttpStatus.OK);
    expect(preserved.body).toMatchObject({
      statusCode: HttpStatus.OK,
      message: 'Article updated successfully',
      data: { body: 'Body changed', tagList: ['nestjs', 'prisma'] },
    });

    const replaced = await e2e.request
      .put('/v1/articles/huong-dan-nestjs')
      .set('Authorization', owner.authorization)
      .send({ tagList: ['replacement'] })
      .expect(HttpStatus.OK);
    expect(replaced.body.data.tagList).toEqual(['replacement']);

    const cleared = await e2e.request
      .put('/v1/articles/huong-dan-nestjs')
      .set('Authorization', owner.authorization)
      .send({ tagList: [] })
      .expect(HttpStatus.OK);
    expect(cleared.body.data.tagList).toEqual([]);

    const updated = await e2e.request
      .put('/v1/articles/huong-dan-nestjs')
      .set('Authorization', owner.authorization)
      .send({ title: 'Updated Article', tagList: ['updated'] })
      .expect(HttpStatus.OK);
    expect(updated.body).toMatchObject({
      statusCode: HttpStatus.OK,
      message: 'Article updated successfully',
      data: { slug: 'updated-article', tagList: ['updated'] },
    });

    await e2e.request
      .get('/v1/articles/huong-dan-nestjs')
      .expect(HttpStatus.NOT_FOUND)
      .expect(({ body }) => {
        expect(body).toEqual({
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Article not found',
        });
      });
    await e2e.request
      .delete('/v1/articles/updated-article')
      .set('Authorization', owner.authorization)
      .expect(HttpStatus.OK)
      .expect(({ body }) => {
        expect(body).toEqual({
          statusCode: HttpStatus.OK,
          message: 'Article deleted successfully',
          data: null,
        });
      });

    await e2e.request
      .get('/v1/articles/updated-article')
      .expect(HttpStatus.NOT_FOUND);
    await expect(
      e2e.prisma.tag.findUnique({ where: { name: 'updated' } }),
    ).resolves.not.toBeNull();
  });
});
