import { HttpStatus } from '@nestjs/common';

import { useE2eSuite } from './support/e2e-suite';

describe('Comment author profile mapping (e2e)', () => {
  const e2e = useE2eSuite('comments-profile-mapping');

  it('maps author.following for anonymous and authenticated viewers', async () => {
    const author = await e2e.fixtures.authenticatedUser({
      username: 'comment_author',
    });
    const viewer = await e2e.fixtures.authenticatedUser({
      username: 'comment_viewer',
    });
    const article = await e2e.fixtures.article({ authorId: author.id });
    await e2e.prisma.comment.create({
      data: {
        body: 'Comment from followed author',
        articleId: article.id,
        authorId: author.id,
      },
    });
    const endpoint = `/v1/articles/${article.slug}/comments`;

    const anonymous = await e2e.request.get(endpoint).expect(HttpStatus.OK);
    expect(anonymous.body.data[0].author.following).toBe(false);

    const unfollowed = await e2e.request
      .get(endpoint)
      .set('Authorization', viewer.authorization)
      .expect(HttpStatus.OK);
    expect(unfollowed.body.data[0].author.following).toBe(false);

    await e2e.request
      .post(`/v1/profiles/${author.username}/follow`)
      .set('Authorization', viewer.authorization)
      .expect(HttpStatus.OK);

    const followed = await e2e.request
      .get(endpoint)
      .set('Authorization', viewer.authorization)
      .expect(HttpStatus.OK);
    expect(followed.body.data[0].author.following).toBe(true);
  });
});
