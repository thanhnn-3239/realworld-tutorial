import { HttpStatus } from '@nestjs/common';

import { useE2eSuite } from './support/e2e-suite';

describe('Article comment CRUD (e2e)', () => {
  const e2e = useE2eSuite('comments-crud');

  it('creates a comment with its author profile', async () => {
    const author = await e2e.fixtures.authenticatedUser({
      username: 'comment_author',
    });
    const article = await e2e.fixtures.article({ authorId: author.id });

    const response = await e2e.request
      .post(`/v1/articles/${article.slug}/comments`)
      .set('Authorization', author.authorization)
      .send({ body: 'A useful comment' })
      .expect(HttpStatus.CREATED);

    expect(response.body).toMatchObject({
      statusCode: HttpStatus.CREATED,
      message: 'Comment created successfully',
      data: {
        id: expect.any(Number),
        body: 'A useful comment',
        author: {
          username: author.username,
          bio: null,
          following: false,
        },
      },
    });
    expect(Object.keys(response.body.data).sort()).toEqual(
      ['id', 'createdAt', 'updatedAt', 'body', 'author'].sort(),
    );
    expect(Object.keys(response.body.data.author).sort()).toEqual(
      ['username', 'bio', 'image', 'following'].sort(),
    );
  });

  it('lists an article comments newest first', async () => {
    const author = await e2e.fixtures.user();
    const article = await e2e.fixtures.article({ authorId: author.id });
    const first = await e2e.prisma.comment.create({
      data: {
        body: 'First comment',
        articleId: article.id,
        authorId: author.id,
      },
    });
    const second = await e2e.prisma.comment.create({
      data: {
        body: 'Second comment',
        articleId: article.id,
        authorId: author.id,
      },
    });

    const response = await e2e.request
      .get(`/v1/articles/${article.slug}/comments`)
      .expect(HttpStatus.OK);

    expect(response.body).toMatchObject({
      statusCode: HttpStatus.OK,
      message: 'Comments retrieved successfully',
      data: [
        { id: second.id, body: 'Second comment' },
        { id: first.id, body: 'First comment' },
      ],
    });
  });

  it('requires authentication and a non-blank comment body to create', async () => {
    const author = await e2e.fixtures.authenticatedUser();
    const article = await e2e.fixtures.article({ authorId: author.id });
    const endpoint = `/v1/articles/${article.slug}/comments`;

    await e2e.request
      .post(endpoint)
      .send({ body: 'Unauthenticated comment' })
      .expect(HttpStatus.UNAUTHORIZED);

    await e2e.request
      .post(endpoint)
      .set('Authorization', author.authorization)
      .send({ body: '   ' })
      .expect(HttpStatus.UNPROCESSABLE_ENTITY)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          message: 'Validation Error',
          errors: { body: 'Body must not be blank' },
        });
      });
  });

  it('allows only the comment author to delete it', async () => {
    const author = await e2e.fixtures.authenticatedUser();
    const other = await e2e.fixtures.authenticatedUser();
    const article = await e2e.fixtures.article({ authorId: author.id });
    const comment = await e2e.prisma.comment.create({
      data: { body: 'Delete me', articleId: article.id, authorId: author.id },
    });
    const endpoint = `/v1/articles/${article.slug}/comments/${comment.id}`;

    await e2e.request.delete(endpoint).expect(HttpStatus.UNAUTHORIZED);
    await e2e.request
      .delete(endpoint)
      .set('Authorization', other.authorization)
      .expect(HttpStatus.FORBIDDEN)
      .expect(({ body }) => {
        expect(body).toEqual({
          statusCode: HttpStatus.FORBIDDEN,
          message: 'Only the comment author can delete this comment',
        });
      });

    await e2e.request
      .delete(endpoint)
      .set('Authorization', author.authorization)
      .expect(HttpStatus.OK)
      .expect(({ body }) => {
        expect(body).toEqual({
          statusCode: HttpStatus.OK,
          message: 'Comment deleted successfully',
          data: null,
        });
      });

    await expect(
      e2e.prisma.comment.findUnique({ where: { id: comment.id } }),
    ).resolves.toBeNull();
  });

  it('returns 404 for an absent article or a comment from another article', async () => {
    const author = await e2e.fixtures.authenticatedUser();
    const first = await e2e.fixtures.article({ authorId: author.id });
    const second = await e2e.fixtures.article({ authorId: author.id });
    const comment = await e2e.prisma.comment.create({
      data: { body: 'First article', articleId: first.id, authorId: author.id },
    });

    await e2e.request
      .get('/v1/articles/missing/comments')
      .expect(HttpStatus.NOT_FOUND);
    await e2e.request
      .delete(`/v1/articles/${second.slug}/comments/${comment.id}`)
      .set('Authorization', author.authorization)
      .expect(HttpStatus.NOT_FOUND);
  });
});
