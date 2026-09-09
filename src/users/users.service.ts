import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { UpdateUserDto } from './dto/update-user.dto';
import { I18nService } from 'nestjs-i18n';
import { AvatarReplacementService } from './avatar-replacement.service';
import { FileStorageService } from '../file-storage/file-storage.service';

export interface UserResponse {
  email: string;
  username: string;
  bio: string | null;
  image: string | null;
}

interface UserUpdateData {
  username?: string;
  bio?: string | null;
  image?: string | null;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly i18n: I18nService,
    private readonly avatarReplacementService: AvatarReplacementService,
    private readonly fileStorage: FileStorageService,
  ) {}

  async getCurrentUser(userId: number): Promise<UserResponse> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(this.i18n.t('common.error.userNotFound'));
    }
    return {
      email: user.email,
      username: user.username,
      bio: user.bio,
      image: this.fileStorage.publicUrl(user.image),
    };
  }

  async updateUser(
    userId: number,
    dto: UpdateUserDto,
    file?: Express.Multer.File,
  ): Promise<UserResponse> {
    if (dto.username) {
      const existingUsername =
        await this.usersRepository.findByUsernameExcluding(
          dto.username,
          userId,
        );
      if (existingUsername) {
        throw new ConflictException(this.i18n.t('common.error.usernameInUse'));
      }
    }

    const updateData: UserUpdateData = { ...dto };

    // Replacement owns the storage lifecycle — upload, atomic commit,
    // compensation and reclaiming the object it superseded — so this method
    // keeps only the conflict concern. Clearing the avatar goes through it too:
    // the previous object would otherwise stay in storage unreferenced.
    if (!file) {
      if (dto.image === null) {
        return this.toResponse(
          await this.avatarReplacementService.clear(userId, updateData),
        );
      }

      return this.toResponse(
        await this.usersRepository.update(userId, updateData),
      );
    }

    return this.toResponse(
      await this.avatarReplacementService.replace(userId, updateData, file),
    );
  }

  private toResponse(user: UserResponse): UserResponse {
    return {
      email: user.email,
      username: user.username,
      bio: user.bio,
      image: this.fileStorage.publicUrl(user.image),
    };
  }
}
