import { HttpStatus } from '@nestjs/common';

import { USER_AVATAR_MAX_SIZE_BYTES } from '../src/users/users.controller';
import {
  createAvatarTestHelpers,
  PNG_1X1,
} from './support/avatar-test-helpers';
import { useE2eSuite } from './support/e2e-suite';

describe('Users avatar upload (e2e)', () => {
  const e2e = useE2eSuite('users-avatar-upload');
  const avatar = createAvatarTestHelpers(e2e);

  it('stores a real file and returns its public URL', async () => {
    const user = await e2e.fixtures.authenticatedUser();

    const response = await avatar
      .upload(user.authorization, 'new avatar')
      .expect(HttpStatus.OK);

    const image = response.body.data.image as string;
    expect(image).not.toContain('avatar.png');
    expect(image).toMatch(
      new RegExp(`/avatars/${user.id}/[0-9a-f-]{36}\\.png$`),
    );
    expect(response.body.data.bio).toBe('new avatar');

    const storedKey = await avatar.storedKey(user.id);
    expect(storedKey).toMatch(new RegExp(`^avatars/${user.id}/`));
    expect(image).toContain(storedKey);
    await expect(avatar.count(user.id)).resolves.toBe(1);
  });

  it('writes no object when update is rejected by username conflict', async () => {
    const occupant = await e2e.fixtures.user();
    const user = await e2e.fixtures.authenticatedUser();

    await e2e.request
      .put('/v1/user')
      .set('Authorization', user.authorization)
      .field('username', occupant.username)
      .attach('image', PNG_1X1, {
        filename: 'avatar.png',
        contentType: 'image/png',
      })
      .expect(HttpStatus.CONFLICT);

    await expect(avatar.count(user.id)).resolves.toBe(0);
    await expect(avatar.storedKey(user.id)).resolves.toBeNull();
  });

  it('rejects unsupported MIME types', async () => {
    const user = await e2e.fixtures.authenticatedUser();

    await e2e.request
      .put('/v1/user')
      .set('Authorization', user.authorization)
      .attach('image', Buffer.from('plain text'), {
        filename: 'note.txt',
        contentType: 'text/plain',
      })
      .expect(HttpStatus.BAD_REQUEST);

    await expect(avatar.count(user.id)).resolves.toBe(0);
  });

  it('rejects files exceeding size limit', async () => {
    const user = await e2e.fixtures.authenticatedUser();
    const oversized = Buffer.alloc(USER_AVATAR_MAX_SIZE_BYTES + 1, 0);

    await e2e.request
      .put('/v1/user')
      .set('Authorization', user.authorization)
      .attach('image', oversized, {
        filename: 'big.png',
        contentType: 'image/png',
      })
      .expect(HttpStatus.PAYLOAD_TOO_LARGE);

    await expect(avatar.count(user.id)).resolves.toBe(0);
  });

  it('rejects a string image because avatars require file upload', async () => {
    const user = await e2e.fixtures.authenticatedUser();

    await e2e.request
      .put('/v1/user')
      .set('Authorization', user.authorization)
      .send({ image: 'https://example.com/avatar.jpg' })
      .expect(HttpStatus.UNPROCESSABLE_ENTITY);
  });
});
