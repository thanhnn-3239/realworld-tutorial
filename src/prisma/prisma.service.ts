import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { ConfigService } from '@nestjs/config';

import { PrismaClient } from '../generated/prisma/client.js';
import { CustomLoggerService } from '../logger/logger.service.js';
import { paginationExtension } from './prisma.extension.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly shouldLogQueries: boolean;
  readonly extended = this.$extends(paginationExtension);

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: CustomLoggerService,
  ) {
    const shouldLogQueries =
      configService.get<string>('NODE_ENV') === 'development' &&
      configService.get<string>('DEBUG_SQL') === 'true';

    const adapter = new PrismaPg({
      connectionString: configService.get<string>('DATABASE_URL'),
    });

    super({
      adapter,
      log: shouldLogQueries
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'info' },
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
          ]
        : ['error'],
    });

    this.shouldLogQueries = shouldLogQueries;
  }

  async onModuleInit() {
    await this.$connect();

    if (this.shouldLogQueries) {
      (this as any).$on('query', (e: any) => {
        this.logger.log(`Query: ${e.query}`);
        this.logger.log(`Params: ${e.params}`);
        this.logger.log(`Duration: ${e.duration}ms`);
      });
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
