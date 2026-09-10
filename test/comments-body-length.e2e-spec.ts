import { HttpStatus } from '@nestjs/common';

import { useE2eSuite } from './support/e2e-suite';

const MAX_COMMENT_BODY_LENGTH = 255;

describe('Comment body length (e2e)', () => {
  const e2e = useE2eSuite('comment-body-length');

  async function scenario() {
    const author = await e2e.fixtures.authenticatedUser();
    const article = await e2e.fixtures.article({ authorId: author.id });
    return { author, article };
  }

  it('accepts a comment body with exactly 255 characters', async () => {
    const { author, article } = await scenario();
    const body = 'x'.repeat(MAX_COMMENT_BODY_LENGTH);

    await e2e.request
      .post(`/v1/articles/${article.slug}/comments`)
      .set('Authorization', author.authorization)
      .send({ body })
      .expect(HttpStatus.CREATED)
      .expect(({ body: responseBody }) => {
        expect(responseBody.data.body).toBe(body);
      });
  });

  it('rejects a comment body with 256 characters', async () => {
    const { author, article } = await scenario();

    await e2e.request
      .post(`/v1/articles/${article.slug}/comments`)
      .set('Authorization', author.authorization)
      .send({ body: 'x'.repeat(MAX_COMMENT_BODY_LENGTH + 1) })
      .expect(HttpStatus.UNPROCESSABLE_ENTITY)
      .expect(({ body }) => {
        expect(body.errors.body).toBe('Body must be at most 255 characters');
      });
  });

  it('enforces the 255-character limit at the database boundary', async () => {
    const { author, article } = await scenario();

    await expect(
      e2e.prisma.comment.create({
        data: {
          articleId: article.id,
          authorId: author.id,
          body: 'x'.repeat(MAX_COMMENT_BODY_LENGTH + 1),
        },
      }),
    ).rejects.toThrow();
  });
});
