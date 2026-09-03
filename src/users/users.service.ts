import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { UpdateUserDto } from './dto/update-user.dto';
import { I18nService } from 'nestjs-i18n';
import { PasswordService } from '../common/password/password.service';

export interface UserResponse {
  email: string;
  username: string;
  bio: string | null;
  image: string | null;
}

interface UserUpdateData {
  email?: string;
  username?: string;
  bio?: string | null;
  image?: string | null;
  password?: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordService: PasswordService,
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
    const { password, ...profileFields } = dto;

    if (profileFields.email) {
      const existingEmail = await this.usersRepository.findByEmailExcluding(
        profileFields.email,
        userId,
      );
      if (existingEmail) {
        throw new ConflictException(this.i18n.t('common.error.emailInUse'));
      }
    }

    if (profileFields.username) {
      const existingUsername =
        await this.usersRepository.findByUsernameExcluding(
          profileFields.username,
          userId,
        );
      if (existingUsername) {
        throw new ConflictException(this.i18n.t('common.error.usernameInUse'));
      }
    }

    const updateData: UserUpdateData = { ...profileFields };

    if (password !== undefined) {
      updateData.password = await this.passwordService.hash(password);
    }

    const updatedUser = await this.usersRepository.update(userId, updateData);

    return {
      email: updatedUser.email,
      username: updatedUser.username,
      bio: updatedUser.bio,
      image: updatedUser.image,
    };
  }
}
