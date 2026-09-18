import { ArticleNotificationConsumer } from './article-notification.consumer';
import { ArticleFavoritedEvent } from '../events/article-favorited.event';
import { ArticleCreatedEvent } from '../events/article-created.event';
import {
  EVENT_ARTICLE_CREATED,
  EVENT_ARTICLE_FAVORITED,
} from '../constants/kafka.constants';

describe('ArticleNotificationConsumer', () => {
  let consumer: ArticleNotificationConsumer;
  const mockUsersRepo = {
    findById: jest.fn(),
    findFollowersByAuthorId: jest.fn(),
  };
  const mockEmailQueueProducer = { enqueueArticleNotification: jest.fn() };
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
        subject: 'jane favorited your article',
        body: 'Hello john, jane just favorited your article "Great Post".',
        eventType: EVENT_ARTICLE_FAVORITED,
        articleId: 1,
      });
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
      mockUsersRepo.findFollowersByAuthorId.mockResolvedValue([
        { id: 21, email: 'follower1@example.com', username: 'follower1' },
        { id: 22, email: 'follower2@example.com', username: 'follower2' },
      ]);

      await consumer.handleArticleCreated(baseCreatedEvent);

      expect(mockUsersRepo.findFollowersByAuthorId).toHaveBeenCalledWith(10);
      expect(
        mockEmailQueueProducer.enqueueArticleNotification,
      ).toHaveBeenCalledTimes(2);
      const makePayload = (id: number, username: string) => ({
        to: `${username}@example.com`,
        recipientId: id,
        recipientUsername: username,
        subject: 'john published a new article',
        body: `Hello ${username}, author john just published a new article: "Brand New Post".`,
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
      mockUsersRepo.findFollowersByAuthorId.mockResolvedValue([]);

      await consumer.handleArticleCreated(baseCreatedEvent);

      expect(mockUsersRepo.findFollowersByAuthorId).toHaveBeenCalledWith(10);
      expect(
        mockEmailQueueProducer.enqueueArticleNotification,
      ).not.toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('No followers found for author 10'),
      );
    });
  });
});
