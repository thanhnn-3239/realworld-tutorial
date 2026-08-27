import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProfilesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetches profile fields for the given username, resolving in the same round
   * trip whether viewerId follows the target.
   */
  findByUsername(username: string, viewerId?: number) {
    return this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
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
    });
  }

  /**
   * Returns true when followerId has a follow record pointing to targetId.
   */
  async isFollowing(followerId: number, targetId: number): Promise<boolean> {
    const record = await this.prisma.user.findFirst({
      where: { id: targetId, followedBy: { some: { id: followerId } } },
      select: { id: true },
    });
    return record !== null;
  }

  /** Adds a follow edge: followerId → targetId. */
  follow(followerId: number, targetId: number): Promise<{ id: number }> {
    return this.prisma.user.update({
      where: { id: followerId },
      data: { following: { connect: { id: targetId } } },
      select: { id: true },
    });
  }

  /** Removes a follow edge: followerId → targetId. */
  unfollow(followerId: number, targetId: number): Promise<{ id: number }> {
    return this.prisma.user.update({
      where: { id: followerId },
      data: { following: { disconnect: { id: targetId } } },
      select: { id: true },
    });
  }
}
