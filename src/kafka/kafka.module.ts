import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';
import { ArticleEventProducer } from './producers/article-event.producer';
import { ArticleNotificationConsumer } from './consumers/article-notification.consumer';
import { KAFKA_CLIENT } from './constants/kafka.constants';
import { parseKafkaConfig } from './kafka.config';

@Module({
  imports: [
    UsersModule,
    EmailModule,
    ClientsModule.registerAsync([
      {
        name: KAFKA_CLIENT,
        useFactory: () => {
          const config = parseKafkaConfig();
          return {
            transport: Transport.KAFKA,
            options: {
              client: config.client,
              producerOnlyMode: true,
              producer: {
                allowAutoTopicCreation: true,
              },
            },
          };
        },
      },
    ]),
  ],
  controllers: [ArticleNotificationConsumer],
  providers: [ArticleEventProducer],
  exports: [ClientsModule, ArticleEventProducer],
})
export class KafkaModule {}
