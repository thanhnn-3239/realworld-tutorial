import { getExtensionFromMime, buildStorageKey } from './file-storage.util';

jest.mock('node:crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('fixed-uuid'),
}));

describe('file-storage.util', () => {
  describe('getExtensionFromMime', () => {
    it('returns extension from known MIME type', () => {
      expect(getExtensionFromMime('image/png')).toBe('png');
      expect(getExtensionFromMime('image/jpeg')).toBe('jpg');
      expect(getExtensionFromMime('image/webp')).toBe('webp');
      expect(getExtensionFromMime('application/pdf')).toBe('pdf');
    });

    it('falls back to original filename extension when MIME type is unknown', () => {
      expect(
        getExtensionFromMime('application/octet-stream', 'avatar.png'),
      ).toBe('png');
      expect(getExtensionFromMime('unknown/type', 'test.custom')).toBe(
        'custom',
      );
    });

    it('returns "bin" when neither MIME nor originalname has a valid extension', () => {
      expect(getExtensionFromMime('unknown/type', 'noextension')).toBe('bin');
      expect(getExtensionFromMime('unknown/type')).toBe('bin');
    });
  });

  describe('buildStorageKey', () => {
    it('builds a clean storage key with folder, UUID, and extension', () => {
      const file = {
        mimetype: 'image/png',
        originalname: 'my-avatar.png',
      } as Express.Multer.File;

      const key = buildStorageKey('avatars/1', file);
      expect(key).toBe('avatars/1/fixed-uuid.png');
    });

    it('strips leading and trailing slashes from folder path', () => {
      const file = {
        mimetype: 'image/jpeg',
        originalname: 'photo.jpg',
      } as Express.Multer.File;

      const key = buildStorageKey('/users/42/avatars/', file);
      expect(key).toBe('users/42/avatars/fixed-uuid.jpg');
    });
  });
});
