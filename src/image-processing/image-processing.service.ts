import {
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import { PiscinaPoolService } from '../worker-pool/piscina-pool.service';
import { CustomLoggerService } from '../logger/logger.service';
import { IMAGE_PROCESSING_PROFILES } from './constants/image-processing-profiles.constants';
import {
  INVALID_IMAGE_MESSAGE,
  UNAVAILABLE_MESSAGE,
} from './constants/image-processing-response-messages.constants';
import type { ImageProcessingProfileName } from './types/image-processing-profile-name.type';
import type { ProcessedImage } from './interfaces/processed-image.interface';
import type {
  ImageProcessingWorkerFailure,
  ImageProcessingWorkerResult,
  ImageProcessingWorkerSuccess,
} from './interfaces/image-processing-worker-result.interface';
import type { ImageProcessingTask } from './interfaces/image-processing-task.interface';
import { IMAGE_PROCESSING_WORKER_PATH_TOKEN } from './constants/image-processing-worker.constants';

/** Resolve a named profile and translate worker outcomes to the HTTP contract. */
@Injectable()
export class ImageProcessingService {
  constructor(
    private readonly pool: PiscinaPoolService,
    private readonly logger: CustomLoggerService,
    @Inject(IMAGE_PROCESSING_WORKER_PATH_TOKEN)
    private readonly workerPath: string,
  ) {}

  async process(
    input: Uint8Array,
    profileName: ImageProcessingProfileName,
  ): Promise<ProcessedImage> {
    const profile = IMAGE_PROCESSING_PROFILES[profileName];
    if (!profile) {
      throw new Error(`Unknown image processing profile: ${profileName}`);
    }

    const startedAt = performance.now();
    const inputByteLength = input.length;

    try {
      const task: ImageProcessingTask = {
        image: Uint8Array.from(input),
        profile,
      };
      const result = await this.pool.run<
        ImageProcessingTask,
        ImageProcessingWorkerResult
      >(task, {
        workerPath: this.workerPath,
        transferList: [task.image.buffer as ArrayBuffer],
      });

      if (!result.ok) {
        this.logRejection(profileName, inputByteLength, result);
        throw new UnprocessableEntityException(INVALID_IMAGE_MESSAGE);
      }

      this.logSuccess(profileName, inputByteLength, result, startedAt);
      return result.image;
    } catch (error) {
      if (error instanceof UnprocessableEntityException) throw error;
      this.logPoolFailure(profileName, inputByteLength, startedAt, error);
      throw new ServiceUnavailableException(UNAVAILABLE_MESSAGE);
    }
  }

  private logSuccess(
    profileName: ImageProcessingProfileName,
    inputByteLength: number,
    result: ImageProcessingWorkerSuccess,
    startedAt: number,
  ): void {
    const elapsedMs = performance.now() - startedAt;
    const queueMs = Math.max(0, elapsedMs - result.processingDurationMs);
    this.logger.log(
      `Image processed profile=${profileName} inputBytes=${inputByteLength} ` +
        `outputBytes=${result.image.size} width=${result.image.width} height=${result.image.height} ` +
        `processingMs=${result.processingDurationMs.toFixed(1)} queueMs=${queueMs.toFixed(1)}`,
    );
  }

  private logRejection(
    profileName: ImageProcessingProfileName,
    inputByteLength: number,
    result: ImageProcessingWorkerFailure,
  ): void {
    this.logger.warn(
      `Image processing rejected profile=${profileName} inputBytes=${inputByteLength} ` +
        `code=${result.code} processingMs=${result.processingDurationMs.toFixed(1)}`,
    );
  }

  private logPoolFailure(
    profileName: ImageProcessingProfileName,
    inputByteLength: number,
    startedAt: number,
    error: unknown,
  ): void {
    const elapsedMs = performance.now() - startedAt;
    // Do not log native decoder messages from untrusted input.
    const errorType = error instanceof Error ? error.name : 'UnknownError';
    this.logger.error(
      `Image processing pool failure profile=${profileName} inputBytes=${inputByteLength} ` +
        `elapsedMs=${elapsedMs.toFixed(1)} errorType=${errorType}`,
    );
  }
}
