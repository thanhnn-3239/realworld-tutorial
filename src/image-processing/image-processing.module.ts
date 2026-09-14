import { Module } from '@nestjs/common';
import { WorkerPoolModule } from '../worker-pool/piscina-pool.module';
import { ImageProcessingService } from './image-processing.service';
import {
  COMPILED_IMAGE_PROCESSING_WORKER_PATH,
  IMAGE_PROCESSING_WORKER_PATH_TOKEN,
} from './constants/image-processing-worker.constants';

@Module({
  imports: [WorkerPoolModule],
  providers: [
    {
      provide: IMAGE_PROCESSING_WORKER_PATH_TOKEN,
      useValue: COMPILED_IMAGE_PROCESSING_WORKER_PATH,
    },
    ImageProcessingService,
  ],
  exports: [ImageProcessingService],
})
export class ImageProcessingModule {}
