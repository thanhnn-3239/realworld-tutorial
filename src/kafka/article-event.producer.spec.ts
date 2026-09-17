import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { CustomLoggerService } from '../logger/logger.service';
import { ArticleEventProducer } from './article-event.producer';
import {
  EVENT_ARTICLE_CREATED,
  EVENT_ARTICLE_FAVORITED,
  KAFKA_CLIENT,
} from './constants/kafka.constants';
import { ArticleCreatedEvent } from './events/article-created.event';
import { ArticleFavoritedEvent } from './events/article-favorited.event';

describe('ArticleEventProducer', () => {
  let producer: ArticleEventProducer;
  const mockKafkaClient = {
    emit: jest.fn(),
  };
  const mockLogger = {
    setContext: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockKafkaClient.emit.mockReturnValue(of(null));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleEventProducer,
        { provide: KAFKA_CLIENT, useValue: mockKafkaClient },
        { provide: CustomLoggerService, useValue: mockLogger },
      ],
    }).compile();

    producer = module.get<ArticleEventProducer>(ArticleEventProducer);
  });

  it('emits article.favorited event with articleId partition key', () => {
    const event: ArticleFavoritedEvent = {
      articleId: 42,
      slug: 'how-to-train-your-dragon',
      title: 'How to train your dragon',
      authorId: 10,
      favoritedByUserId: 20,
      favoritedByUsername: 'jane',
      occurredAt: '2026-09-17T12:00:00.000Z',
    };

    producer.emitArticleFavorited(event);

    expect(mockKafkaClient.emit).toHaveBeenCalledWith(EVENT_ARTICLE_FAVORITED, {
      key: '42',
      value: event,
    });
  });

  it('emits article.created event with articleId partition key', () => {
    const event: ArticleCreatedEvent = {
      articleId: 42,
      slug: 'how-to-train-your-dragon',
      title: 'How to train your dragon',
      authorId: 10,
      authorUsername: 'john',
      occurredAt: '2026-09-17T12:00:00.000Z',
    };

    producer.emitArticleCreated(event);

    expect(mockKafkaClient.emit).toHaveBeenCalledWith(EVENT_ARTICLE_CREATED, {
      key: '42',
      value: event,
    });
  });

  it('catches and logs error without throwing if emit throws synchronously', () => {
    mockKafkaClient.emit.mockImplementation(() => {
      throw new Error('Kafka connection down');
    });

    expect(() =>
      producer.emitArticleFavorited({
        articleId: 1,
        slug: 'slug',
        title: 'title',
        authorId: 2,
        favoritedByUserId: 3,
        favoritedByUsername: 'user',
        occurredAt: 'now',
      }),
    ).not.toThrow();

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Kafka connection down'),
    );
  });

  it('logs error when Observable emitted by emitArticleFavorited errors asynchronously', () => {
    mockKafkaClient.emit.mockReturnValue(
      throwError(() => new Error('Async broker disconnect')),
    );

    producer.emitArticleFavorited({
      articleId: 1,
      slug: 'slug',
      title: 'title',
      authorId: 2,
      favoritedByUserId: 3,
      favoritedByUsername: 'user',
      occurredAt: 'now',
    });

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Async broker disconnect'),
    );
  });

  it('logs error when Observable emitted by emitArticleCreated errors asynchronously', () => {
    mockKafkaClient.emit.mockReturnValue(
      throwError(() => new Error('Async broker disconnect on created')),
    );

    producer.emitArticleCreated({
      articleId: 2,
      slug: 'slug-created',
      title: 'title-created',
      authorId: 3,
      authorUsername: 'author',
      occurredAt: 'now',
    });

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Async broker disconnect on created'),
    );
  });
});
