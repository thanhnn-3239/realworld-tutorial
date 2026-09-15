import { HttpStatus } from '@nestjs/common';
import sharp from 'sharp';

import {
  createAvatarImageFixtureSet,
  type AvatarImageFixtureSet,
} from './support/avatar-image-fixture.factory';
import { createAvatarTestHelpers } from './support/avatar-test-helpers';
import { useE2eSuite } from './support/e2e-suite';

const FIXTURE_HOOK_TIMEOUT_MS = 30_000;

function storedKeyPattern(userId: number): RegExp {
  return new RegExp(`^avatars/${userId}/[0-9a-f-]{36}\\.webp$`);
}

describe('Users avatar upload (e2e)', () => {
  const e2e = useE2eSuite('users-avatar-upload');
  const avatar = createAvatarTestHelpers(e2e);
  let fixtures: AvatarImageFixtureSet;

  beforeAll(async () => {
    fixtures = await createAvatarImageFixtureSet();
  }, FIXTURE_HOOK_TIMEOUT_MS);

  async function expectProcessedUpload(
    data: Buffer,
    contentType: string,
    filename: string,
  ): Promise<{ userId: number; storedKey: string }> {
    const user = await e2e.fixtures.authenticatedUser();

    const response = await avatar
      .upload(user.authorization, 'new avatar', { data, contentType, filename })
      .expect(HttpStatus.OK);

    const image = response.body.data.image as string;
    const storedKey = await avatar.requiredStoredKey(user.id);
    expect(storedKey).toMatch(storedKeyPattern(user.id));
    expect(image).toContain(storedKey);
    await expect(avatar.count(user.id)).resolves.toBe(1);

    const stored = await e2e.read(storedKey);
    expect(stored.contentType).toBe('image/webp');

    const metadata = await sharp(stored.body).metadata();
    expect(metadata).toMatchObject({ format: 'webp', width: 512, height: 512 });
    // Sharp omits `pages` entirely for a single-frame image rather than
    // reporting `1` — the same default the worker's own validation relies on
    // (`(metadata.pages ?? 1) > profile.maxPages`), so this asserts the same
    // effective page count instead of the literal (absent) field.
    expect(metadata.pages ?? 1).toBe(1);

    return { userId: user.id, storedKey };
  }

  it.each([
    ['a JPEG', () => fixtures.jpeg, 'image/jpeg', 'avatar.jpg'] as const,
    ['a PNG', () => fixtures.png, 'image/png', 'avatar.png'] as const,
    ['a WebP', () => fixtures.webp, 'image/webp', 'avatar.webp'] as const,
  ])(
    'stores %s upload as a processed 512x512 webp object',
    async (_label, getData, contentType, filename) => {
      await expectProcessedUpload(getData(), contentType, filename);
    },
  );

  it('accepts an image at the exact minimum shortest side (256px)', async () => {
    // `fixtures.png` is generated at exactly `AVATAR_FIXTURE_VALID_SIDE`
    // (256px) — the same fixture the accepted-format table above already
    // uses, so this only documents the intent: the boundary is inclusive.
    await expectProcessedUpload(fixtures.png, 'image/png', 'boundary.png');
  });

  it('writes no object when update is rejected by username conflict', async () => {
    const occupant = await e2e.fixtures.user();
    const user = await e2e.fixtures.authenticatedUser();

    await e2e.request
      .put('/v1/user')
      .set('Authorization', user.authorization)
      .field('username', occupant.username)
      .attach('image', fixtures.png, {
        filename: 'avatar.png',
        contentType: 'image/png',
      })
      .expect(HttpStatus.CONFLICT);

    await expect(avatar.count(user.id)).resolves.toBe(0);
    await expect(avatar.storedKey(user.id)).resolves.toBeNull();
  });

  it('rejects a string image because avatars require file upload', async () => {
    const user = await e2e.fixtures.authenticatedUser();

    await e2e.request
      .put('/v1/user')
      .set('Authorization', user.authorization)
      .send({ image: 'https://example.com/avatar.jpg' })
      .expect(HttpStatus.UNPROCESSABLE_ENTITY);

    await expect(avatar.storedKey(user.id)).resolves.toBeNull();
    await expect(avatar.count(user.id)).resolves.toBe(0);
  });

  it.each([
    [
      'text bytes declared as PNG',
      () => fixtures.textAsPng,
      'image/png',
      'fake.png',
      HttpStatus.UNPROCESSABLE_ENTITY,
    ] as const,
    [
      'a valid GIF',
      () => fixtures.gif,
      'image/gif',
      'avatar.gif',
      HttpStatus.BAD_REQUEST,
    ] as const,
    [
      'an SVG',
      () => fixtures.svg,
      'image/svg+xml',
      'avatar.svg',
      HttpStatus.BAD_REQUEST,
    ] as const,
    [
      'an animated WebP',
      () => fixtures.animatedWebp,
      'image/webp',
      'animated.webp',
      HttpStatus.UNPROCESSABLE_ENTITY,
    ] as const,
    [
      'an image below the minimum shortest side (255px)',
      () => fixtures.tooSmallPng,
      'image/png',
      'small.png',
      HttpStatus.UNPROCESSABLE_ENTITY,
    ] as const,
    [
      'an image exceeding the 16,000,000 pixel limit',
      () => fixtures.pixelLimitPng,
      'image/png',
      'huge.png',
      HttpStatus.UNPROCESSABLE_ENTITY,
    ] as const,
    [
      'a file exceeding the 5 MiB size limit',
      () => fixtures.oversizedPng,
      'image/png',
      'big.png',
      HttpStatus.PAYLOAD_TOO_LARGE,
    ] as const,
  ])(
    'rejects %s and leaves no trace',
    async (_label, getData, contentType, filename, expectedStatus) => {
      const user = await e2e.fixtures.authenticatedUser();

      await avatar
        .upload(user.authorization, 'rejected', {
          data: getData(),
          contentType,
          filename,
        })
        .expect(expectedStatus);

      await expect(avatar.storedKey(user.id)).resolves.toBeNull();
      await expect(avatar.count(user.id)).resolves.toBe(0);
    },
  );
});
