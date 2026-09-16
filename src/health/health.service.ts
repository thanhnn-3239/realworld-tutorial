import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailQueueReadinessService } from '../email/email-queue-readiness.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueReadiness: EmailQueueReadinessService,
  ) {}

  async check(): Promise<{ status: 'ok' }> {
    try {
      await Promise.all([
        this.prisma.$queryRaw(Prisma.sql`SELECT 1`),
        this.queueReadiness.ping(),
      ]);
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException('Service unavailable');
    }
  }
}
