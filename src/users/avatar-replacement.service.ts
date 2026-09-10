import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { UsersRepository } from './users.repository';
import { PrismaService } from '../prisma/prisma.service';
import { FileStorageService } from '../file-storage/file-storage.service';
import { buildStorageKey } from '../file-storage/file-storage.util';
import { CustomLoggerService } from '../logger/logger.service';
import type { UserRow } from './interfaces/user-row.interface';

@Injectable()
export class AvatarReplacementService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly prisma: PrismaService,
    private readonly fileStorageService: FileStorageService,
    private readonly logger: CustomLoggerService,
  ) {}

  async replace(
    userId: number,
    updateData: Prisma.UserUpdateInput,
    file: Express.Multer.File,
  ): Promise<UserRow> {
    const uploadedKey = buildStorageKey(`avatars/${userId}`, file);

    await this.fileStorageService.upload(uploadedKey, file);

    let result: { user: UserRow; previous: string | null };

    try {
      result = await this.atomicUpdateAvatar(userId, updateData, uploadedKey);
    } catch (databaseError) {
      await this.cleanupFailedUpload(uploadedKey, databaseError);
      throw databaseError;
    }

    await this.cleanupPreviousAvatar(result.previous);

    return result.user;
  }

  async clear(
    userId: number,
    updateData: Prisma.UserUpdateInput,
  ): Promise<UserRow> {
    const { user, previous } = await this.atomicUpdateAvatar(
      userId,
      updateData,
      null,
    );
    await this.cleanupPreviousAvatar(previous);

    return user;
  }

  /**
   * The lock is what orders concurrent writers: the second one reads the key
   * the first committed, so exactly one object is left unreferenced and it is
   * the right one.
   */
  private async atomicUpdateAvatar(
    userId: number,
    updateData: Prisma.UserUpdateInput,
    image: string | null,
  ): Promise<{ user: UserRow; previous: string | null }> {
    return this.prisma.$transaction(async (tx) => {
      const previous = await this.usersRepository.lockImage(userId, tx);
      const user = await this.usersRepository.update(
        userId,
        { ...updateData, image },
        tx,
      );

      return { user, previous };
    });
  }

  /**
   * The upload already landed but the rows rolled back, so the new object is
   * unreferenced. A failure here cannot replace the database error the caller
   * needs, so it is only recorded.
   */
  private async cleanupFailedUpload(
    key: string,
    databaseError: unknown,
  ): Promise<void> {
    try {
      await this.fileStorageService.delete(key);
    } catch {
      this.logger.error(
        `Orphaned object ${key} after a failed avatar transaction (${describe(databaseError)}); its removal also failed`,
      );
    }
  }

  /**
   * Runs after the commit, so a failure here would turn a successful update
   * into an HTTP error. The object is left behind and recorded instead; it is
   * unreferenced, so nothing serves it.
   */
  private async cleanupPreviousAvatar(previous: string | null): Promise<void> {
    if (previous === null) {
      return;
    }

    try {
      await this.fileStorageService.delete(previous);
    } catch {
      // The cause is already in the log from `FileStorageService.delete`; this
      // entry only names the key that outlived the row that referenced it.
      this.logger.error(`Superseded object ${previous} was not removed`);
    }
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
