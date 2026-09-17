import { Module } from '@nestjs/common';
import { PiscinaPoolService } from './piscina-pool.service';

@Module({
  providers: [PiscinaPoolService],
  exports: [PiscinaPoolService],
})
export class WorkerPoolModule {}
