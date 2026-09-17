import { Inject, Injectable } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { CustomLoggerService } from '../logger/logger.service';
import {
  EVENT_ARTICLE_CREATED,
  EVENT_ARTICLE_FAVORITED,
  KAFKA_CLIENT,
} from './constants/kafka.constants';
import { ArticleCreatedEvent } from './events/article-created.event';
import { ArticleFavoritedEvent } from './events/article-favorited.event';

@Injectable()
export class ArticleEventProducer {
  constructor(
    @Inject(KAFKA_CLIENT) private readonly kafkaClient: ClientKafka,
    private readonly logger: CustomLoggerService,
  ) {
    this.logger.setContext(ArticleEventProducer.name);
  }

  emitArticleFavorited(event: ArticleFavoritedEvent): void {
    try {
      this.kafkaClient.emit(EVENT_ARTICLE_FAVORITED, {
        key: String(event.articleId),
        value: event,
      });
      this.logger.log(
        `Emitted ${EVENT_ARTICLE_FAVORITED} for article ${event.articleId}`,
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to emit ${EVENT_ARTICLE_FAVORITED} for article ${event.articleId}: ${err.message}`,
      );
    }
  }

  emitArticleCreated(event: ArticleCreatedEvent): void {
    try {
      this.kafkaClient.emit(EVENT_ARTICLE_CREATED, {
        key: String(event.articleId),
        value: event,
      });
      this.logger.log(
        `Emitted ${EVENT_ARTICLE_CREATED} for article ${event.articleId}`,
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to emit ${EVENT_ARTICLE_CREATED} for article ${event.articleId}: ${err.message}`,
      );
    }
  }
}
