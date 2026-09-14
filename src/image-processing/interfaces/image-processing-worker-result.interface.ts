import type { ProcessedImage } from './processed-image.interface';
import type { ImageProcessingErrorCode } from '../types/image-processing-error-code.type';

export interface ImageProcessingWorkerSuccess {
  ok: true;
  image: ProcessedImage;
  processingDurationMs: number;
}

export interface ImageProcessingWorkerFailure {
  ok: false;
  code: ImageProcessingErrorCode;
  processingDurationMs: number;
}

export type ImageProcessingWorkerResult =
  | ImageProcessingWorkerSuccess
  | ImageProcessingWorkerFailure;
