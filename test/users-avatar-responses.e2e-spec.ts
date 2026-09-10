import { HttpStatus } from '@nestjs/common';

import { createAvatarTestHelpers } from './support/avatar-test-helpers';
import { useE2eSuite } from './support/e2e-suite';

function expectPublicUrl(image: unknown) {
  expect(typeof image).toBe('string');
  expect(image).not.toMatch(/^(public|avatars)\//);
}

describe('Users avatar responses (e2e)', () => {
  const e2e = useE2eSuite('users-avatar-responses');
  const avatar = createAvatarTestHelpers(e2e);

  it('never exposes raw storage keys from avatar-serving endpoints', async () => {
    const user = await e2e.fixtures.authenticatedUser();
    await avatar.upload(user.authorization, 'has-avatar').expect(HttpStatus.OK);

    const currentUser = await e2e.request
      .get('/v1/user')
      .set('Authorization', user.authorization)
      .expect(HttpStatus.OK);
    expectPublicUrl(currentUser.body.data.image);

    const profile = await e2e.request
      .get(`/v1/profiles/${user.username}`)
      .expect(HttpStatus.OK);
    expectPublicUrl(profile.body.data.image);

    const created = await e2e.request
      .post('/v1/articles')
      .set('Authorization', user.authorization)
      .send({
        title: 'Avatar key guard',
        description: 'Serves an author profile',
        body: 'Article body',
      })
      .expect(HttpStatus.CREATED);
    const slug = created.body.data.slug as string;

    const article = await e2e.request
      .get(`/v1/articles/${slug}`)
      .expect(HttpStatus.OK);
    expectPublicUrl(article.body.data.author.image);

    const comment = await e2e.request
      .post(`/v1/articles/${slug}/comments`)
      .set('Authorization', user.authorization)
      .send({ body: 'A comment carrying its author profile' })
      .expect(HttpStatus.CREATED);
    expectPublicUrl(comment.body.data.author.image);

    const login = await e2e.request
      .post('/v1/auth/login')
      .send({ email: user.email, password: user.plainPassword })
      .expect(HttpStatus.OK);
    expectPublicUrl(login.body.data.image);
  });
});
