import { BadRequestException } from '@nestjs/common';
import { ALLOWED_AVATAR_MIME_TYPES } from './constants/avatar-upload.constants';

export function avatarFileFilter(
  _req: unknown,
  file: { mimetype: string },
  cb: (error: Error | null, acceptFile: boolean) => void,
): void {
  if (ALLOWED_AVATAR_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestException('Unsupported file type'), false);
  }
}
