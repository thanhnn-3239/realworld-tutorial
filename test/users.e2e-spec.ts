import { randomBytes } from 'node:crypto';
import { HttpStatus, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './support/test-app';
import { createTestDatabase, TestDatabase } from './support/test-database';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  STORAGE_DRIVER,
  type StorageDriver,
} from '../src/file-storage/storage-driver.interface';
import { USER_AVATAR_MAX_SIZE_BYTES } from '../src/users/users.controller';

const HOOK_TIMEOUT_MS = 60_000;

/**
 * Smallest byte sequence Multer and MinIO both accept as a PNG; the suite only
 * cares that the bytes survive the round trip, not that they render.
 */
const PNG_1X1 = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
    '1f15c4890000000a49444154789c6300010000050001' +
    '0d0a2db40000000049454e44ae426082',
  'hex',
);

describe('Users avatar upload (e2e)', () => {
  const suiteNonce = randomBytes(4).toString('hex');
  let db: TestDatabase | undefined;
  let app: INestApplication<App> | undefined;
  let driver: StorageDriver | undefined;
  let fixtureNumber = 0;

  beforeAll(async () => {
    db = await createTestDatabase('users_avatar');
    app = await createTestApp(db);

    // Resolves the driver already wired into the container instead of
    // building a second one, so the suite and the service under test
    // provably share one backend regardless of which driver is active.
    driver = app.get<StorageDriver>(STORAGE_DRIVER);
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await app?.close();
    await db?.drop();
  }, HOOK_TIMEOUT_MS);

  function httpServer() {
    if (!app) {
      throw new Error('Users avatar e2e application is not initialized');
    }
    return app.getHttpServer();
  }

  async function register() {
    fixtureNumber += 1;
    const id = `${suiteNonce}${fixtureNumber}`;
    const response = await request(httpServer())
      .post('/v1/auth/register')
      .send({
        email: `avatar-${id}@example.com`,
        username: `av_${id}`,
        password: 'password123',
        password_confirmation: 'password123',
      })
      .expect(HttpStatus.CREATED);

    const prisma = app!.get(PrismaService);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: `avatar-${id}@example.com` },
      select: { id: true },
    });

    // The bucket outlives the run while the cloned database restarts ids at 1,
    // so objects from an earlier run would otherwise land under this prefix and
    // corrupt every count below.
    await purgeStoredObjects(user.id);

    return {
      token: response.body.data.accessToken as string,
      userId: user.id,
      username: `av_${id}`,
      email: `avatar-${id}@example.com`,
    };
  }

  async function listStoredKeys(userId: number) {
    return driver!.list(`avatars/${userId}/`);
  }

  async function purgeStoredObjects(userId: number) {
    // Deleted one at a time: the driver contract exposes no batch delete, and
    // these prefixes hold only a handful of keys.
    for (const key of await listStoredKeys(userId)) {
      await driver!.delete(key);
    }
  }

  async function countStoredObjects(userId: number) {
    return (await listStoredKeys(userId)).length;
  }

  it(
    'stores real file and returns public URL instead of upload filename',
    async () => {
      const { token, userId } = await register();

      const response = await request(httpServer())
        .put('/v1/user')
        .set('Authorization', `Bearer ${token}`)
        .field('bio', 'new avatar')
        .attach('image', PNG_1X1, {
          filename: 'avatar.png',
          contentType: 'image/png',
        })
        .expect(HttpStatus.OK);

      const image = response.body.data.image as string;
      expect(image).not.toContain('avatar.png');
      expect(image).toMatch(
        new RegExp(`/avatars/${userId}/[0-9a-f-]{36}\\.png$`),
      );
      expect(response.body.data.bio).toBe('new avatar');

      // The column holds the storage key; only the response mapper turns it
      // into the absolute URL asserted above.
      const prisma = app!.get(PrismaService);
      const stored = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { image: true },
      });
      expect(stored.image).toMatch(new RegExp(`^avatars/${userId}/`));
      expect(image).toContain(stored.image);

      await expect(countStoredObjects(userId)).resolves.toBe(1);
    },
    HOOK_TIMEOUT_MS,
  );

  it(
    'writes no object when update is rejected due to username conflict',
    async () => {
      const occupant = await register();
      const { token, userId } = await register();

      const occupantName = await app!
        .get(PrismaService)
        .user.findUniqueOrThrow({
          where: { id: occupant.userId },
          select: { username: true },
        });

      await request(httpServer())
        .put('/v1/user')
        .set('Authorization', `Bearer ${token}`)
        .field('username', occupantName.username)
        .attach('image', PNG_1X1, {
          filename: 'avatar.png',
          contentType: 'image/png',
        })
        .expect(HttpStatus.CONFLICT);

      // The upload must not run before the conflict check, or every rejected
      // request would leave an unreferenced object behind in the bucket.
      await expect(countStoredObjects(userId)).resolves.toBe(0);
      await expect(readStoredImageKey(userId)).resolves.toBeNull();
    },
    HOOK_TIMEOUT_MS,
  );

  // Returns supertest's chainable Test rather than a Promise, so callers can
  // still attach .expect() before awaiting.
  function uploadAvatar(token: string, bio: string) {
    return request(httpServer())
      .put('/v1/user')
      .set('Authorization', `Bearer ${token}`)
      .field('bio', bio)
      .attach('image', PNG_1X1, {
        filename: 'avatar.png',
        contentType: 'image/png',
      });
  }

  // Reads the raw column, which stores a key such as
  // `avatars/7/<uuid>.png` rather than the URL the API returns.
  async function readStoredImageKey(userId: number) {
    const user = await app!.get(PrismaService).user.findUniqueOrThrow({
      where: { id: userId },
      select: { image: true },
    });
    return user.image;
  }

  // Narrows away the null the column allows, so the key assertions below stay
  // free of non-null assertions.
  async function readAvatarKey(userId: number) {
    const key = await readStoredImageKey(userId);
    if (key === null) {
      throw new Error(`User ${userId} has no stored avatar key`);
    }
    return key;
  }

  it(
    'reclaims old image from both database and object store when replacing avatar',
    async () => {
      const { token, userId } = await register();

      const first = await uploadAvatar(token, 'first').expect(HttpStatus.OK);
      const firstUrl = first.body.data.image as string;
      await expect(countStoredObjects(userId)).resolves.toBe(1);

      const second = await uploadAvatar(token, 'second').expect(HttpStatus.OK);
      const secondUrl = second.body.data.image as string;
      expect(secondUrl).not.toBe(firstUrl);

      const storedKey = await readAvatarKey(userId);
      expect(secondUrl).toContain(storedKey);
      expect(firstUrl).not.toContain(storedKey);

      const remaining = await listStoredKeys(userId);
      expect(remaining).toEqual([storedKey]);
    },
    HOOK_TIMEOUT_MS,
  );

  it(
    'retains exactly one image when two replacement requests run concurrently',
    async () => {
      const { token, userId } = await register();
      await uploadAvatar(token, 'original').expect(HttpStatus.OK);

      const [left, right] = await Promise.all([
        uploadAvatar(token, 'concurrent-1'),
        uploadAvatar(token, 'concurrent-2'),
      ]);

      expect(left.status).toBe(HttpStatus.OK);
      expect(right.status).toBe(HttpStatus.OK);

      // Which writer commits last is not predictable, so the winner is derived
      // from the persisted row rather than assumed from the response order.
      const finalKey = await readAvatarKey(userId);
      const responseUrls = [
        left.body.data.image as string,
        right.body.data.image as string,
      ];
      expect(responseUrls.filter((url) => url.includes(finalKey))).toHaveLength(
        1,
      );

      // Both writers uploaded, so the loser's object must have been reclaimed:
      // without the row lock the second writer would read a stale previous key
      // and leave two objects behind.
      const remaining = await listStoredKeys(userId);
      expect(remaining).toEqual([finalKey]);
    },
    HOOK_TIMEOUT_MS,
  );

  it(
    'rejects unsupported MIME types',
    async () => {
      const { token, userId } = await register();

      await request(httpServer())
        .put('/v1/user')
        .set('Authorization', `Bearer ${token}`)
        .attach('image', Buffer.from('plain text'), {
          filename: 'note.txt',
          contentType: 'text/plain',
        })
        .expect(HttpStatus.BAD_REQUEST);

      await expect(countStoredObjects(userId)).resolves.toBe(0);
    },
    HOOK_TIMEOUT_MS,
  );

  it(
    'rejects files exceeding size limit',
    async () => {
      const { token, userId } = await register();
      const oversized = Buffer.alloc(USER_AVATAR_MAX_SIZE_BYTES + 1, 0);

      await request(httpServer())
        .put('/v1/user')
        .set('Authorization', `Bearer ${token}`)
        .attach('image', oversized, {
          filename: 'big.png',
          contentType: 'image/png',
        })
        .expect(HttpStatus.PAYLOAD_TOO_LARGE);

      await expect(countStoredObjects(userId)).resolves.toBe(0);
    },
    HOOK_TIMEOUT_MS,
  );

  it(
    'rejects string image because avatar can only be set via upload',
    async () => {
      const { token } = await register();

      await request(httpServer())
        .put('/v1/user')
        .set('Authorization', `Bearer ${token}`)
        .send({ image: 'https://example.com/avatar.jpg' })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY);
    },
    HOOK_TIMEOUT_MS,
  );

  it(
    'accepts null image to remove avatar and deletes stored object',
    async () => {
      const { token, userId } = await register();

      await uploadAvatar(token, 'with-avatar').expect(HttpStatus.OK);
      await expect(countStoredObjects(userId)).resolves.toBe(1);

      const response = await request(httpServer())
        .put('/v1/user')
        .set('Authorization', `Bearer ${token}`)
        .send({ image: null })
        .expect(HttpStatus.OK);

      expect(response.body.data.image).toBeNull();
      await expect(countStoredObjects(userId)).resolves.toBe(0);
      await expect(readStoredImageKey(userId)).resolves.toBeNull();
    },
    HOOK_TIMEOUT_MS,
  );

  // The stored key is only ever safe to expose once `toResponse` has turned it
  // into a URL, so every endpoint that serves an avatar is held to this.
  function expectPublicUrl(image: unknown) {
    expect(typeof image).toBe('string');
    expect(image).not.toMatch(/^(public|avatars)\//);
  }

  it(
    'never returns raw storage key in response across all endpoints serving avatar',
    async () => {
      const { token, username, email } = await register();
      await uploadAvatar(token, 'has-avatar').expect(HttpStatus.OK);

      const currentUser = await request(httpServer())
        .get('/v1/user')
        .set('Authorization', `Bearer ${token}`)
        .expect(HttpStatus.OK);
      expectPublicUrl(currentUser.body.data.image);

      const profile = await request(httpServer())
        .get(`/v1/profiles/${username}`)
        .expect(HttpStatus.OK);
      expectPublicUrl(profile.body.data.image);

      const created = await request(httpServer())
        .post('/v1/articles')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: `Avatar key guard ${username}`,
          description: 'Serves an author profile',
          body: 'Article body',
        })
        .expect(HttpStatus.CREATED);
      const slug = created.body.data.slug as string;

      const article = await request(httpServer())
        .get(`/v1/articles/${slug}`)
        .expect(HttpStatus.OK);
      expectPublicUrl(article.body.data.author.image);

      const comment = await request(httpServer())
        .post(`/v1/articles/${slug}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ body: 'A comment carrying its author profile' })
        .expect(HttpStatus.CREATED);
      expectPublicUrl(comment.body.data.author.image);

      const login = await request(httpServer())
        .post('/v1/auth/login')
        .send({ email, password: 'password123' })
        .expect(HttpStatus.OK);
      expectPublicUrl(login.body.data.image);
    },
    HOOK_TIMEOUT_MS,
  );
});
