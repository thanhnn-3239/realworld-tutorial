import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CustomLoggerService } from '../../logger/logger.service';
import { EXPIRED_PROVIDER_LINK_CLEANUP_CONTEXT } from './constants/pending-provider-link.constants';
import { PendingProviderLinkRepository } from './pending-provider-link.repository';

@Injectable()
export class ExpiredProviderLinkCleanupService {
  constructor(
    private readonly pendingRepo: PendingProviderLinkRepository,
    private readonly logger: CustomLoggerService,
  ) {
    this.logger.setContext(EXPIRED_PROVIDER_LINK_CLEANUP_CONTEXT);
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async removeExpiredLinks(): Promise<void> {
    try {
      const deleted = await this.pendingRepo.deleteExpired(new Date());

      this.logger.log(
        `Deleted ${deleted} expired provider links`,
        EXPIRED_PROVIDER_LINK_CLEANUP_CONTEXT,
      );
    } catch {
      this.logger.error(
        'Expired provider link cleanup failed',
        EXPIRED_PROVIDER_LINK_CLEANUP_CONTEXT,
      );
    }
  }
}
