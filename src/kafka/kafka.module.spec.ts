import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { LoggerModule } from '../logger/logger.module';
import { UsersModule } from '../users/users.module';
import { UsersRepository } from '../users/users.repository';
import { EmailModule } from '../email/email.module';
import { EmailQueueProducer } from '../email/email-queue.producer';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { ArticleEventProducer } from './article-event.producer';
import { ArticleNotificationConsumer } from './consumers/article-notification.consumer';
import { KafkaModule } from './kafka.module';
import { KAFKA_CLIENT } from './constants/kafka.constants';

@Module({
  providers: [{ provide: UsersRepository, useValue: {} }],
  exports: [UsersRepository],
})
class MockUsersModule {}

@Module({
  providers: [{ provide: EmailQueueProducer, useValue: {} }],
  exports: [EmailQueueProducer],
})
class MockEmailModule {}

@Module({
  providers: [{ provide: PrismaService, useValue: {} }],
  exports: [PrismaService],
})
class MockPrismaModule {}

describe('KafkaModule', () => {
  let moduleRef: TestingModule;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        LoggerModule.register(),
        KafkaModule,
      ],
    })
      .overrideModule(UsersModule)
      .useModule(MockUsersModule)
      .overrideModule(EmailModule)
      .useModule(MockEmailModule)
      .overrideModule(PrismaModule)
      .useModule(MockPrismaModule)
      .compile();
  });

  it('should be defined', () => {
    expect(moduleRef).toBeDefined();
  });

  it('should provide KAFKA_CLIENT', () => {
    const kafkaClient = moduleRef.get(KAFKA_CLIENT);
    expect(kafkaClient).toBeDefined();
  });

  it('should provide ArticleEventProducer', () => {
    const producer = moduleRef.get(ArticleEventProducer);
    expect(producer).toBeDefined();
  });

  it('should provide ArticleNotificationConsumer', () => {
    const consumer = moduleRef.get(ArticleNotificationConsumer);
    expect(consumer).toBeDefined();
  });
});
