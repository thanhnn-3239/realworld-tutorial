import { HttpStatus } from '@nestjs/common';

import { createArticleViaApi } from './support/article-test-helpers';
import { useE2eSuite } from './support/e2e-suite';

describe('Article authorization and validation (e2e)', () => {
  const e2e = useE2eSuite('articles-authorization-validation');

  it('requires authentication for every mutation route', async () => {
    const payload = {
      title: 'Unauthorized',
      description: 'Description',
      body: 'Body',
    };

    await e2e.request
      .post('/v1/articles')
      .send(payload)
      .expect(HttpStatus.UNAUTHORIZED);
    await e2e.request
      .put('/v1/articles/unauthorized')
      .send({ title: 'Forbidden without token' })
      .expect(HttpStatus.UNAUTHORIZED);
    await e2e.request
      .delete('/v1/articles/unauthorized')
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('forbids a non-author from updating or deleting an article', async () => {
    const owner = await e2e.fixtures.authenticatedUser();
    const other = await e2e.fixtures.authenticatedUser();
    await createArticleViaApi(e2e, owner.authorization, 'Ownership');

    for (const method of ['put', 'delete'] as const) {
      const mutation = e2e.request[method]('/v1/articles/ownership').set(
        'Authorization',
        other.authorization,
      );
      if (method === 'put') mutation.send({ title: 'Forbidden update' });
      await mutation.expect(HttpStatus.FORBIDDEN).expect(({ body }) => {
        expect(body).toEqual({
          statusCode: HttpStatus.FORBIDDEN,
          message: 'Only the author can modify this article',
        });
      });
    }
  });

  it('returns 404 for read, update and delete of a missing slug', async () => {
    const owner = await e2e.fixtures.authenticatedUser();

    await e2e.request.get('/v1/articles/missing').expect(HttpStatus.NOT_FOUND);
    await e2e.request
      .put('/v1/articles/missing')
      .set('Authorization', owner.authorization)
      .send({ title: 'Still missing' })
      .expect(HttpStatus.NOT_FOUND);
    await e2e.request
      .delete('/v1/articles/missing')
      .set('Authorization', owner.authorization)
      .expect(HttpStatus.NOT_FOUND);
  });

  it('returns 422 for DTO violations and an empty update', async () => {
    const owner = await e2e.fixtures.authenticatedUser();
    const invalidCreate = await e2e.request
      .post('/v1/articles')
      .set('Authorization', owner.authorization)
      .send({
        title: '   ',
        description: 'Description',
        body: 'Body',
        tagList: null,
      })
      .expect(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(invalidCreate.body).toMatchObject({
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      message: 'Validation Error',
      errors: {
        title: 'Title must not be blank',
        tagList: 'Tag is invalid',
      },
    });

    await createArticleViaApi(e2e, owner.authorization, 'Validation');

    const invalidUpdate = await e2e.request
      .put('/v1/articles/validation')
      .set('Authorization', owner.authorization)
      .send({ description: '   ' })
      .expect(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(invalidUpdate.body).toMatchObject({
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      message: 'Validation Error',
      errors: { description: 'Description must not be blank' },
    });

    await e2e.request
      .put('/v1/articles/validation')
      .set('Authorization', owner.authorization)
      .send({})
      .expect(HttpStatus.UNPROCESSABLE_ENTITY)
      .expect(({ body }) => {
        expect(body).toEqual({
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          message: 'Provide at least one article field to update',
        });
      });
  });
});
