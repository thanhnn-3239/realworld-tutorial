import {
  STORAGE_DRIVER,
  type StorageDriver,
} from '../../src/file-storage/storage-driver.interface';
import { createValidAvatarFixture } from './avatar-image-fixture.factory';
import type { E2eContext } from './e2e-suite';

const DEFAULT_FIXTURE_HOOK_TIMEOUT_MS = 30_000;

export interface AvatarUploadOverride {
  readonly data?: Buffer;
  readonly filename?: string;
  readonly contentType?: string;
}

export function createAvatarTestHelpers(e2e: E2eContext) {
  const driver = () => e2e.resolve<StorageDriver>(STORAGE_DRIVER);

  // Generated once per suite (not per assertion) and reused as the default
  // upload body — a real, decodable PNG at the profile's minimum accepted
  // shortest side, so the default path exercises the same validation a
  // production upload would, instead of a fixture too small to be real.
  let defaultFixture: Buffer | undefined;

  beforeAll(async () => {
    defaultFixture = await createValidAvatarFixture();
  }, DEFAULT_FIXTURE_HOOK_TIMEOUT_MS);

  function requireDefaultFixture(): Buffer {
    if (!defaultFixture) {
      throw new Error(
        'Default avatar fixture is not initialized; beforeAll did not run',
      );
    }
    return defaultFixture;
  }

  function upload(
    authorization: string,
    bio: string,
    override?: AvatarUploadOverride,
  ) {
    return e2e.request
      .put('/v1/user')
      .set('Authorization', authorization)
      .field('bio', bio)
      .attach('image', override?.data ?? requireDefaultFixture(), {
        filename: override?.filename ?? 'avatar.png',
        contentType: override?.contentType ?? 'image/png',
      });
  }

  async function list(userId: number) {
    return driver().list(`avatars/${userId}/`);
  }

  async function count(userId: number) {
    return (await list(userId)).length;
  }

  async function storedKey(userId: number) {
    const user = await e2e.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { image: true },
    });
    return user.image;
  }

  async function requiredStoredKey(userId: number) {
    const key = await storedKey(userId);
    if (key === null) {
      throw new Error(`User ${userId} has no stored avatar key`);
    }
    return key;
  }

  return { count, list, requiredStoredKey, storedKey, upload };
}
