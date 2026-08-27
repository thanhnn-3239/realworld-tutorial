import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

function buildCommentSelect(viewerId?: number) {
  return {
    id: true,
    createdAt: true,
    updatedAt: true,
    body: true,
    author: {
      select: {
        username: true,
        bio: true,
        image: true,
        // Select shape stays constant so Prisma keeps the narrow payload
        // type; an empty `in` matches nothing, so anonymous reads yield [].
        followedBy: {
          where: viewerId === undefined ? { id: { in: [] } } : { id: viewerId },
          select: { id: true },
        },
      },
    },
  } satisfies Prisma.CommentSelect;
}

export type CommentRecord = Prisma.CommentGetPayload<{
  select: ReturnType<typeof buildCommentSelect>;
}>;

export interface CommentIdentity {
  id: number;
  authorId: number;
}

@Injectable()
export class CommentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByArticleId(
    articleId: number,
    viewerId?: number,
  ): Promise<CommentRecord[]> {
    return this.prisma.comment.findMany({
      where: { articleId },
      select: buildCommentSelect(viewerId),
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
      select: buildCommentSelect(),
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
