import { Global, Module } from '@nestjs/common';
import { S3StorageDriver } from './drivers/s3-storage.driver';
import { FileStorageService } from './file-storage.service';
import { STORAGE_DRIVER } from './storage-driver.interface';

@Global()
@Module({
  providers: [
    // Bound directly rather than through an env-driven factory: S3 is the only
    // implementation, and a selector with one valid value is configuration
    // nobody can act on. The token stays so a second backend can be introduced
    // without touching any consumer.
    { provide: STORAGE_DRIVER, useClass: S3StorageDriver },
    FileStorageService,
  ],
  // The token is exported alongside the facade so the e2e suite can reach the
  // active driver and enumerate stored objects.
  exports: [FileStorageService, STORAGE_DRIVER],
})
export class FileStorageModule {}
