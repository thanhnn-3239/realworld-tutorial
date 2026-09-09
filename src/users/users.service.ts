import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { UpdateUserDto } from './dto/update-user.dto';
import { I18nService } from 'nestjs-i18n';

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
      image: user.image,
    };
  }

  async updateUser(userId: number, dto: UpdateUserDto): Promise<UserResponse> {
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
    const updatedUser = await this.usersRepository.update(userId, updateData);

    return {
      email: updatedUser.email,
      username: updatedUser.username,
      bio: updatedUser.bio,
      image: updatedUser.image,
    };
  }
}
