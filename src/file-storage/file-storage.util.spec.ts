import { buildStorageKey } from './file-storage.util';

jest.mock('node:crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('fixed-uuid'),
}));

describe('file-storage.util', () => {
  describe('buildStorageKey', () => {
    it('builds a clean storage key with folder, UUID, and extension', () => {
      expect(buildStorageKey('avatars/1', 'webp')).toBe(
        'avatars/1/fixed-uuid.webp',
      );
    });

    it('strips leading and trailing slashes from folder path', () => {
      expect(buildStorageKey('/users/42/avatars/', 'jpg')).toBe(
        'users/42/avatars/fixed-uuid.jpg',
      );
    });

    it('strips leading dots and lowercases the extension', () => {
      expect(buildStorageKey('avatars/1', '.PNG')).toBe(
        'avatars/1/fixed-uuid.png',
      );
    });

    it('throws for an extension carrying a path traversal segment', () => {
      expect(() => buildStorageKey('avatars/1', '../png')).toThrow(
        'Invalid storage extension',
      );
    });

    it('throws for an extension embedding further traversal', () => {
      expect(() => buildStorageKey('avatars/1', 'png/../../etc')).toThrow(
        'Invalid storage extension',
      );
    });

    it('throws for an empty extension', () => {
      expect(() => buildStorageKey('avatars/1', '')).toThrow(
        'Invalid storage extension',
      );
    });
  });
});
