import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { STORAGE_DRIVER } from './storage-driver.interface';
import type { StorageDriver } from './storage-driver.interface';
import { CustomLoggerService } from '../logger/logger.service';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'application/zip': 'zip',
};

function extensionFromMime(mimeType: string, originalname?: string): string {
  if (MIME_TO_EXT[mimeType]) {
    return MIME_TO_EXT[mimeType];
  }
  if (originalname && originalname.includes('.')) {
    const ext = originalname.split('.').pop()?.toLowerCase();
    if (ext && /^[a-z0-9]+$/.test(ext)) {
      return ext;
    }
  }
  return 'bin';
}

@Injectable()
export class FileStorageService {
  constructor(
    @Inject(STORAGE_DRIVER) private readonly driver: StorageDriver,
    private readonly logger: CustomLoggerService,
  ) {}

  async upload(
    file: Express.Multer.File,
    ownerType: string,
    ownerId: string,
  ): Promise<string> {
    const ext = extensionFromMime(file.mimetype, file.originalname);
    // The `public/` prefix is what lets the bucket grant anonymous reads to
    // one prefix instead of the whole bucket (see docker/minio-init.sh), so
    // anything stored outside it stays private by default. A later private
    // tier can then live at `private/...` without relocating these objects.
    const key = `public/uploads/${ownerType}/${ownerId}/${randomUUID()}.${ext}`;

    try {
      await this.driver.put(key, file.buffer, {
        contentType: file.mimetype,
        contentLength: file.size,
      });
    } catch (error) {
      this.logger.error(
        `Storage upload failed for key ${key}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadGatewayException('File upload failed');
    }

    return key;
  }

  /**
   * `User.image` stores a key, never a URL, so every response that carries an
   * avatar passes it through here. Null means the user has no avatar.
   */
  publicUrl(key: string | null): string | null {
    return key === null ? null : this.driver.url(key);
  }

  async delete(key: string): Promise<void> {
    try {
      await this.driver.delete(key);
    } catch (error) {
      this.logger.error(
        `Storage deletion failed for key ${key}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadGatewayException('File deletion failed');
    }
  }
}
