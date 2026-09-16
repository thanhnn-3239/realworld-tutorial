import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BackgroundJobsModule } from '../background-jobs/background-jobs.module';

@Module({
  imports: [
    BackgroundJobsModule,
    BullModule.registerQueue({
      name: 'email',
      configKey: 'email-producer',
    }),
  ],
  exports: [BullModule],
})
export class EmailModule {}
