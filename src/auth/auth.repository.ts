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
