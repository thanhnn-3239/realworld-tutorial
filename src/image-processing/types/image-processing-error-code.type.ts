import type { IMAGE_PROCESSING_ERROR_CODES } from '../constants/image-processing-error-codes.constants';

export type ImageProcessingErrorCode =
  (typeof IMAGE_PROCESSING_ERROR_CODES)[keyof typeof IMAGE_PROCESSING_ERROR_CODES];
