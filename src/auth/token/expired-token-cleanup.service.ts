import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CustomLoggerService } from '../../logger/logger.service';
import { RefreshTokenRepository } from './refresh-token.repository';

const LOG_CONTEXT = 'ExpiredTokenCleanup';

@Injectable()
export class ExpiredTokenCleanupService {
  constructor(
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly logger: CustomLoggerService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async removeExpiredTokens(): Promise<void> {
    try {
      const deleted = await this.refreshTokens.deleteExpired(new Date());

      this.logger.log(`Deleted ${deleted} expired refresh tokens`, LOG_CONTEXT);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Expired refresh token cleanup failed: ${reason}`,
        LOG_CONTEXT,
      );
    }
  }
}
