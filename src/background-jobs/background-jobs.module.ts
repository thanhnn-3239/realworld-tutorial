import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { parseRedisUrl } from './redis.config';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync('email-producer', {
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          ...parseRedisUrl(
            config.get<string>('REDIS_URL') || 'redis://localhost:6379',
          ),
          maxRetriesPerRequest: 1,
        },
        prefix: config.get<string>('REDIS_PREFIX') || 'realworld',
      }),
    }),
    BullModule.forRootAsync('email-worker', {
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          ...parseRedisUrl(
            config.get<string>('REDIS_URL') || 'redis://localhost:6379',
          ),
          maxRetriesPerRequest: null,
        },
        prefix: config.get<string>('REDIS_PREFIX') || 'realworld',
      }),
    }),
  ],
  exports: [BullModule],
})
export class BackgroundJobsModule {}
