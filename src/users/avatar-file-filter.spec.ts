import { BadRequestException } from '@nestjs/common';
import { avatarFileFilter } from './avatar-file-filter';
import { ALLOWED_AVATAR_MIME_TYPES } from './constants/avatar-upload.constants';

describe('avatarFileFilter', () => {
  it.each(ALLOWED_AVATAR_MIME_TYPES)(
    'accepts allowed mime type %s',
    (mimetype) => {
      const callback = jest.fn();
      avatarFileFilter(null, { mimetype }, callback);

      expect(callback).toHaveBeenCalledWith(null, true);
    },
  );

  it.each([
    'image/gif',
    'image/svg+xml',
    'application/pdf',
    'text/plain',
    'image/tiff',
  ])('rejects disallowed mime type %s with BadRequestException', (mimetype) => {
    const callback = jest.fn();
    avatarFileFilter(null, { mimetype }, callback);

    expect(callback).toHaveBeenCalledWith(
      expect.any(BadRequestException),
      false,
    );
    const error = callback.mock.calls[0][0];
    expect(error.message).toBe('Unsupported file type');
  });
});
