import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { CustomLoggerService } from '../../logger/logger.service';
import { UsersRepository } from '../../users/users.repository';
import { EmailQueueProducer } from '../../email/email-queue.producer';
import { PrismaService } from '../../prisma/prisma.service';
import {
  EVENT_ARTICLE_CREATED,
  EVENT_ARTICLE_FAVORITED,
} from '../constants/kafka.constants';
import type { ArticleFavoritedEvent } from '../events/article-favorited.event';
import type { ArticleCreatedEvent } from '../events/article-created.event';

@Controller()
export class ArticleNotificationConsumer {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly emailQueueProducer: EmailQueueProducer,
    private readonly prisma: PrismaService,
    private readonly logger: CustomLoggerService,
  ) {
    this.logger.setContext(ArticleNotificationConsumer.name);
  }

  @EventPattern(EVENT_ARTICLE_FAVORITED)
  async handleArticleFavorited(
    @Payload() event: ArticleFavoritedEvent,
  ): Promise<void> {
    if (event.favoritedByUserId === event.authorId) {
      this.logger.log(
        `Skipping self-favorite notification for article ${event.articleId} (user ${event.favoritedByUserId})`,
      );
      return;
    }

    const author = await this.usersRepository.findById(event.authorId);
    if (!author) {
      this.logger.warn(
        `Author ${event.authorId} not found for article ${event.articleId}, skipping notification`,
      );
      return;
    }

    let actorUsername = event.favoritedByUsername;
    if (!actorUsername || actorUsername.startsWith('user-')) {
      const actor = await this.usersRepository.findById(
        event.favoritedByUserId,
      );
      if (actor?.username) {
        actorUsername = actor.username;
      }
    }

    await this.emailQueueProducer.enqueueArticleNotification({
      to: author.email,
      recipientId: author.id,
      recipientUsername: author.username,
      subject: `${actorUsername} đã thích bài viết của bạn`,
      body: `Xin chào ${author.username}, ${actorUsername} vừa thích bài viết "${event.title}" của bạn.`,
      eventType: EVENT_ARTICLE_FAVORITED,
      articleId: event.articleId,
    });
  }

  @EventPattern(EVENT_ARTICLE_CREATED)
  async handleArticleCreated(
    @Payload() event: ArticleCreatedEvent,
  ): Promise<void> {
    const followers = await this.prisma.user.findMany({
      where: { following: { some: { id: event.authorId } } },
      select: { id: true, email: true, username: true },
    });

    if (followers.length === 0) {
      this.logger.log(
        `No followers found for author ${event.authorId}, no emails enqueued`,
      );
      return;
    }

    await Promise.all(
      followers.map((follower) =>
        this.emailQueueProducer.enqueueArticleNotification({
          to: follower.email,
          recipientId: follower.id,
          recipientUsername: follower.username,
          subject: `${event.authorUsername} vừa đăng bài viết mới`,
          body: `Xin chào ${follower.username}, tác giả ${event.authorUsername} vừa đăng bài viết mới: "${event.title}".`,
          eventType: EVENT_ARTICLE_CREATED,
          articleId: event.articleId,
        }),
      ),
    );

    this.logger.log(
      `Enqueued ${followers.length} notification emails for article ${event.articleId}`,
    );
  }
}
