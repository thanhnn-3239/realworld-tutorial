import { HttpStatus } from '@nestjs/common';

import type { E2eContext } from './e2e-suite';

export function createArticleViaApi(
  e2e: E2eContext,
  authorization: string,
  title: string,
  overrides: Record<string, unknown> = {},
) {
  return e2e.request
    .post('/v1/articles')
    .set('Authorization', authorization)
    .send({
      title,
      description: 'Description',
      body: 'Body',
      ...overrides,
    })
    .expect(HttpStatus.CREATED);
}
