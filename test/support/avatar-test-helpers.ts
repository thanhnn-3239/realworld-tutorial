import {
  STORAGE_DRIVER,
  type StorageDriver,
} from '../../src/file-storage/storage-driver.interface';
import type { E2eContext } from './e2e-suite';

export const PNG_1X1 = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
    '1f15c4890000000a49444154789c6300010000050001' +
    '0d0a2db40000000049454e44ae426082',
  'hex',
);

export function createAvatarTestHelpers(e2e: E2eContext) {
  const driver = () => e2e.resolve<StorageDriver>(STORAGE_DRIVER);

  function upload(authorization: string, bio: string) {
    return e2e.request
      .put('/v1/user')
      .set('Authorization', authorization)
      .field('bio', bio)
      .attach('image', PNG_1X1, {
        filename: 'avatar.png',
        contentType: 'image/png',
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
