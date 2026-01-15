import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) { }

  async findById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      select: this.publicUserSelect(),
    });
  }

  async update(id: number, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({
      where: { id },
      data,
      select: this.publicUserSelect(),
    });
  }

  async findByEmailExcluding(email: string, excludeId: number) {
    return this.prisma.user.findFirst({
      where: {
        email,
        NOT: { id: excludeId },
      },
      select: { id: true },
    });
  }

  async findByUsernameExcluding(username: string, excludeId: number) {
    return this.prisma.user.findFirst({
      where: {
        username,
        NOT: { id: excludeId },
      },
      select: { id: true },
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
