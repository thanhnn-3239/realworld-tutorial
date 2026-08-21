import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { UpdateUserDto } from './dto/update-user.dto';
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
  ) {}

  async getCurrentUser(userId: number): Promise<UserResponse> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
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
        throw new ConflictException('Email already in use');
      }
    }

    if (profileFields.username) {
      const existingUsername =
        await this.usersRepository.findByUsernameExcluding(
          profileFields.username,
          userId,
        );
      if (existingUsername) {
        throw new ConflictException('Username already in use');
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
