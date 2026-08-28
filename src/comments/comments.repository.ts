import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const commentResponseSelect = {
  id: true,
  createdAt: true,
  updatedAt: true,
  body: true,
  author: {
    select: { username: true, bio: true, image: true },
  },
} satisfies Prisma.CommentSelect;

export type CommentRecord = Prisma.CommentGetPayload<{
  select: typeof commentResponseSelect;
}>;

export interface CommentIdentity {
  id: number;
  authorId: number;
}

@Injectable()
export class CommentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByArticleId(articleId: number): Promise<CommentRecord[]> {
    return this.prisma.comment.findMany({
      where: { articleId },
      select: commentResponseSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  create(
    articleId: number,
    authorId: number,
    body: string,
  ): Promise<CommentRecord> {
    return this.prisma.comment.create({
      data: { articleId, authorId, body },
      select: commentResponseSelect,
    });
  }

  findIdentity(id: number, articleId: number): Promise<CommentIdentity | null> {
    return this.prisma.comment.findFirst({
      where: { id, articleId },
      select: { id: true, authorId: true },
    });
  }

  async delete(id: number): Promise<void> {
    await this.prisma.comment.delete({ where: { id }, select: { id: true } });
  }
}
