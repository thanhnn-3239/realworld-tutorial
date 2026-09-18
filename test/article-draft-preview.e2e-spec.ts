import { HttpStatus } from '@nestjs/common';

import { useE2eSuite } from './support/e2e-suite';

describe('Article draft preview (e2e)', () => {
  const e2e = useE2eSuite('article-draft-preview', {
    startContentPreviewGrpc: true,
  });

  it('requires authentication', async () => {
    await e2e.request
      .post('/v1/articles/preview')
      .send({ body: 'Draft' })
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('analyzes an authenticated draft through gRPC', async () => {
    const author = await e2e.fixtures.authenticatedUser();

    await e2e.request
      .post('/v1/articles/preview')
      .set('Authorization', author.authorization)
      .send({ body: '  NestJS\n gRPC  ' })
      .expect(HttpStatus.OK)
      .expect(({ body }) =>
        expect(body.data).toEqual({
          excerpt: 'NestJS gRPC',
          wordCount: 2,
          readingTimeMinutes: 1,
        }),
      );
  });

  it('rejects a blank draft body', async () => {
    const author = await e2e.fixtures.authenticatedUser();

    await e2e.request
      .post('/v1/articles/preview')
      .set('Authorization', author.authorization)
      .send({ body: '   ' })
      .expect(HttpStatus.UNPROCESSABLE_ENTITY)
      .expect(({ body }) =>
        expect(body.errors.body).toBe('Body must not be blank'),
      );
  });
});
