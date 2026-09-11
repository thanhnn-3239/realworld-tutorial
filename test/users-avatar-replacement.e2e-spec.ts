import { HttpStatus } from '@nestjs/common';

import { createAvatarTestHelpers } from './support/avatar-test-helpers';
import { useE2eSuite } from './support/e2e-suite';

describe('Users avatar replacement (e2e)', () => {
  const e2e = useE2eSuite('users-avatar-replacement');
  const avatar = createAvatarTestHelpers(e2e);

  it('reclaims the old object when replacing an avatar', async () => {
    const user = await e2e.fixtures.authenticatedUser();

    const first = await avatar
      .upload(user.authorization, 'first')
      .expect(HttpStatus.OK);
    await expect(avatar.count(user.id)).resolves.toBe(1);
    const second = await avatar
      .upload(user.authorization, 'second')
      .expect(HttpStatus.OK);

    const firstUrl = first.body.data.image as string;
    const secondUrl = second.body.data.image as string;
    const storedKey = await avatar.requiredStoredKey(user.id);

    expect(secondUrl).not.toBe(firstUrl);
    expect(secondUrl).toContain(storedKey);
    expect(firstUrl).not.toContain(storedKey);
    await expect(avatar.list(user.id)).resolves.toEqual([storedKey]);
  });

  it('retains one object when two replacements run concurrently', async () => {
    const user = await e2e.fixtures.authenticatedUser();
    await avatar.upload(user.authorization, 'original').expect(HttpStatus.OK);

    const [left, right] = await Promise.all([
      avatar.upload(user.authorization, 'concurrent-1'),
      avatar.upload(user.authorization, 'concurrent-2'),
    ]);
    expect(left.status).toBe(HttpStatus.OK);
    expect(right.status).toBe(HttpStatus.OK);

    const finalKey = await avatar.requiredStoredKey(user.id);
    const responseUrls = [
      left.body.data.image as string,
      right.body.data.image as string,
    ];
    expect(responseUrls.filter((url) => url.includes(finalKey))).toHaveLength(
      1,
    );
    await expect(avatar.list(user.id)).resolves.toEqual([finalKey]);
  });

  it('accepts null image and deletes the stored object', async () => {
    const user = await e2e.fixtures.authenticatedUser();
    await avatar
      .upload(user.authorization, 'with-avatar')
      .expect(HttpStatus.OK);
    await expect(avatar.count(user.id)).resolves.toBe(1);

    const response = await e2e.request
      .put('/v1/user')
      .set('Authorization', user.authorization)
      .send({ image: null })
      .expect(HttpStatus.OK);

    expect(response.body.data.image).toBeNull();
    await expect(avatar.count(user.id)).resolves.toBe(0);
    await expect(avatar.storedKey(user.id)).resolves.toBeNull();
  });
});
