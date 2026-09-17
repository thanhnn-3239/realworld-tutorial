import { ArticleNotificationConsumer } from './article-notification.consumer';
import { ArticleFavoritedEvent } from '../events/article-favorited.event';
import { ArticleCreatedEvent } from '../events/article-created.event';
import {
  EVENT_ARTICLE_CREATED,
  EVENT_ARTICLE_FAVORITED,
} from '../constants/kafka.constants';

describe('ArticleNotificationConsumer', () => {
  let consumer: ArticleNotificationConsumer;
  const mockUsersRepo = { findById: jest.fn() };
  const mockEmailQueueProducer = { enqueueArticleNotification: jest.fn() };
  const mockPrisma = { user: { findMany: jest.fn() } };
  const mockLogger = {
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const baseFavEvent: ArticleFavoritedEvent = {
    articleId: 1,
    slug: 'slug',
    title: 'Great Post',
    authorId: 10,
    favoritedByUserId: 20,
    favoritedByUsername: 'jane',
    occurredAt: 'now',
  };

  const baseCreatedEvent: ArticleCreatedEvent = {
    articleId: 5,
    slug: 'new-article',
    title: 'Brand New Post',
    authorId: 10,
    authorUsername: 'john',
    occurredAt: 'now',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    consumer = new ArticleNotificationConsumer(
      mockUsersRepo as any,
      mockEmailQueueProducer as any,
      mockPrisma as any,
      mockLogger as any,
    );
  });

  it('should be defined', () => {
    expect(consumer).toBeDefined();
  });

  describe('handleArticleFavorited', () => {
    it('skips notification when user favorites their own article', async () => {
      await consumer.handleArticleFavorited({
        ...baseFavEvent,
        favoritedByUserId: 10,
      });

      expect(mockUsersRepo.findById).not.toHaveBeenCalled();
      expect(
        mockEmailQueueProducer.enqueueArticleNotification,
      ).not.toHaveBeenCalled();
    });

    it('enqueues notification email to author when someone else favorites', async () => {
      mockUsersRepo.findById.mockResolvedValue({
        id: 10,
        email: 'author@example.com',
        username: 'john',
      });

      await consumer.handleArticleFavorited(baseFavEvent);

      expect(mockUsersRepo.findById).toHaveBeenCalledWith(10);
      expect(
        mockEmailQueueProducer.enqueueArticleNotification,
      ).toHaveBeenCalledWith({
        to: 'author@example.com',
        recipientId: 10,
        recipientUsername: 'john',
        subject: 'jane đã thích bài viết của bạn',
        body: 'Xin chào john, jane vừa thích bài viết "Great Post" của bạn.',
        eventType: EVENT_ARTICLE_FAVORITED,
        articleId: 1,
      });
    });

    it('resolves acting username via UsersRepository when username starts with user-', async () => {
      mockUsersRepo.findById
        .mockResolvedValueOnce({
          id: 10,
          email: 'author@example.com',
          username: 'john',
        })
        .mockResolvedValueOnce({
          id: 20,
          email: 'jake@example.com',
          username: 'jake',
        });

      await consumer.handleArticleFavorited({
        ...baseFavEvent,
        favoritedByUsername: 'user-20',
      });

      expect(mockUsersRepo.findById).toHaveBeenCalledWith(10);
      expect(mockUsersRepo.findById).toHaveBeenCalledWith(20);
      expect(
        mockEmailQueueProducer.enqueueArticleNotification,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'jake đã thích bài viết của bạn',
          body: 'Xin chào john, jake vừa thích bài viết "Great Post" của bạn.',
        }),
      );
    });

    it('handles author not found gracefully without throwing', async () => {
      mockUsersRepo.findById.mockResolvedValue(null);

      await expect(
        consumer.handleArticleFavorited({
          ...baseFavEvent,
          authorId: 999,
        }),
      ).resolves.not.toThrow();

      expect(
        mockEmailQueueProducer.enqueueArticleNotification,
      ).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Author 999 not found'),
      );
    });
  });

  describe('handleArticleCreated', () => {
    it('queries followers and enqueues notification for each follower', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 21, email: 'follower1@example.com', username: 'follower1' },
        { id: 22, email: 'follower2@example.com', username: 'follower2' },
      ]);

      await consumer.handleArticleCreated(baseCreatedEvent);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { following: { some: { id: 10 } } },
        select: { id: true, email: true, username: true },
      });
      expect(
        mockEmailQueueProducer.enqueueArticleNotification,
      ).toHaveBeenCalledTimes(2);
      const makePayload = (id: number, username: string) => ({
        to: `${username}@example.com`,
        recipientId: id,
        recipientUsername: username,
        subject: 'john vừa đăng bài viết mới',
        body: `Xin chào ${username}, tác giả john vừa đăng bài viết mới: "Brand New Post".`,
        eventType: EVENT_ARTICLE_CREATED,
        articleId: 5,
      });
      expect(
        mockEmailQueueProducer.enqueueArticleNotification,
      ).toHaveBeenNthCalledWith(1, makePayload(21, 'follower1'));
      expect(
        mockEmailQueueProducer.enqueueArticleNotification,
      ).toHaveBeenNthCalledWith(2, makePayload(22, 'follower2'));
    });

    it('handles author with no followers gracefully', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      await consumer.handleArticleCreated(baseCreatedEvent);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { following: { some: { id: 10 } } },
        select: { id: true, email: true, username: true },
      });
      expect(
        mockEmailQueueProducer.enqueueArticleNotification,
      ).not.toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('No followers found for author 10'),
      );
    });
  });
});
