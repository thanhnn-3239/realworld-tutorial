import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.UserCreateInput) {
    return this.prisma.user.create({
      data,
      select: this.publicUserSelect(),
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: this.publicUserSelect(),
    });
  }

  /**
   * Finds a user by email and includes the password field.
   *
   * ⚠️ WARNING: This method returns sensitive password data.
   * Should ONLY be used for authentication purposes (login verification).
   * For all other use cases, use findByEmail() instead.
   *
   * @param email - The user's email address
   * @returns User object with password field included, or null if not found
   */
  async findByEmailWithPassword(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
      select: this.publicUserSelect(),
    });
  }

  private publicUserSelect(): Prisma.UserSelect {
    return {
      id: true,
      email: true,
      username: true,
      bio: true,
      image: true,
    };
  }
}
