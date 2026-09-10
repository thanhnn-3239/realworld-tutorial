import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import { STORAGE_DRIVER } from './storage-driver.interface';
import type { StorageDriver } from './storage-driver.interface';
import { CustomLoggerService } from '../logger/logger.service';

@Injectable()
export class FileStorageService {
  constructor(
    @Inject(STORAGE_DRIVER) private readonly driver: StorageDriver,
    private readonly logger: CustomLoggerService,
  ) {}

  async upload(key: string, file: Express.Multer.File): Promise<string> {
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

  publicUrl(key: string | null): string | null {
    return key === null ? null : this.driver.url(key);
  }

  async delete(key: string): Promise<void> {
    try {
      await this.driver.delete(key);
      this.logger.log(`Deleted stored object ${key}`);
    } catch (error) {
      this.logger.error(
        `Storage deletion failed for key ${key}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadGatewayException('File deletion failed');
    }
  }
}
