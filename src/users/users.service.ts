import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { UpdateUserDto } from './dto/update-user.dto';

export interface UserResponse {
  email: string;
  username: string;
  bio: string | null;
  image: string | null;
}

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) { }

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
    if (dto.email) {
      const existingEmail = await this.usersRepository.findByEmailExcluding(
        dto.email,
        userId,
      );
      if (existingEmail) {
        throw new ConflictException('Email already in use');
      }
    }

    if (dto.username) {
      const existingUsername =
        await this.usersRepository.findByUsernameExcluding(dto.username, userId);
      if (existingUsername) {
        throw new ConflictException('Username already in use');
      }
    }

    const updatedUser = await this.usersRepository.update(userId, dto);

    return {
      email: updatedUser.email,
      username: updatedUser.username,
      bio: updatedUser.bio,
      image: updatedUser.image,
    };
  }
}
