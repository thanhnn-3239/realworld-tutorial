import sharp from 'sharp';
import { move, transferableSymbol, valueSymbol } from 'piscina';
import {
  SHARP_PIXEL_LIMIT_MESSAGE,
  SHARP_WORKER_CONCURRENCY,
} from '../constants/sharp-image-processing.constants';
import { IMAGE_PROCESSING_ERROR_CODES } from '../constants/image-processing-error-codes.constants';
import type { ImageProcessingTask } from '../interfaces/image-processing-task.interface';
import type { ImageProcessingProfile } from '../interfaces/image-processing-profile.interface';
import type {
  ImageProcessingWorkerFailure,
  ImageProcessingWorkerResult,
  ImageProcessingWorkerSuccess,
} from '../interfaces/image-processing-worker-result.interface';
import type { ImageProcessingErrorCode } from '../types/image-processing-error-code.type';

sharp.concurrency(SHARP_WORKER_CONCURRENCY);

type ReadMetadataOutcome =
  | { ok: true; value: sharp.Metadata }
  | { ok: false; result: ImageProcessingWorkerFailure };

function failure(
  code: ImageProcessingErrorCode,
  startedAt: number,
): ImageProcessingWorkerFailure {
  return {
    ok: false,
    code,
    processingDurationMs: performance.now() - startedAt,
  };
}

async function readMetadata(
  input: Uint8Array,
  profile: ImageProcessingProfile,
  startedAt: number,
): Promise<ReadMetadataOutcome> {
  try {
    const value = await sharp(input, {
      limitInputPixels: profile.limitInputPixels,
    }).metadata();
    return { ok: true, value };
  } catch (error) {
    const code =
      error instanceof Error && error.message === SHARP_PIXEL_LIMIT_MESSAGE
        ? IMAGE_PROCESSING_ERROR_CODES.IMAGE_PIXEL_LIMIT_EXCEEDED
        : IMAGE_PROCESSING_ERROR_CODES.INVALID_IMAGE;
    return {
      ok: false,
      result: failure(code, startedAt),
    };
  }
}

/** Validate the same oriented dimensions the transform will use. */
function validateMetadata(
  metadata: sharp.Metadata,
  profile: ImageProcessingProfile,
  startedAt: number,
): ImageProcessingWorkerFailure | undefined {
  if (!metadata.format || !profile.acceptedFormats.includes(metadata.format)) {
    return failure(
      IMAGE_PROCESSING_ERROR_CODES.UNSUPPORTED_IMAGE_FORMAT,
      startedAt,
    );
  }

  if ((metadata.pages ?? 1) > profile.maxPages) {
    return failure(IMAGE_PROCESSING_ERROR_CODES.MULTI_FRAME_IMAGE, startedAt);
  }

  const width = metadata.autoOrient?.width;
  const height = metadata.autoOrient?.height;
  if (!width || !height) {
    return failure(IMAGE_PROCESSING_ERROR_CODES.INVALID_IMAGE, startedAt);
  }

  if (width * height > profile.limitInputPixels) {
    return failure(
      IMAGE_PROCESSING_ERROR_CODES.IMAGE_PIXEL_LIMIT_EXCEEDED,
      startedAt,
    );
  }

  if (Math.min(width, height) < profile.minShortestSide) {
    return failure(IMAGE_PROCESSING_ERROR_CODES.IMAGE_TOO_SMALL, startedAt);
  }

  return undefined;
}

/** Transfer the nested output buffer instead of cloning it. */
function moveWorkerSuccess(
  data: Uint8Array,
  info: sharp.OutputInfo,
  processingDurationMs: number,
): ImageProcessingWorkerSuccess {
  const success: ImageProcessingWorkerSuccess = {
    ok: true,
    image: {
      data,
      format: 'webp',
      mimeType: 'image/webp',
      extension: 'webp',
      width: info.width,
      height: info.height,
      size: info.size,
    },
    processingDurationMs,
  };

  const transferable = {
    get [transferableSymbol]() {
      return [success.image.data.buffer];
    },
    get [valueSymbol]() {
      return success;
    },
  };

  return move(transferable) as unknown as ImageProcessingWorkerSuccess;
}

/** Normalize one validated avatar profile and return a Piscina-movable result. */
export async function processImageTask(
  task: ImageProcessingTask,
): Promise<ImageProcessingWorkerResult> {
  const startedAt = performance.now();

  const metadata = await readMetadata(task.image, task.profile, startedAt);
  if (!metadata.ok) return metadata.result;

  const violation = validateMetadata(metadata.value, task.profile, startedAt);
  if (violation) return violation;

  // A valid header can still hide truncated pixel data; that remains invalid input.
  try {
    const { data, info } = await sharp(task.image, {
      animated: task.profile.animated,
      pages: task.profile.maxPages,
      limitInputPixels: task.profile.limitInputPixels,
    })
      .autoOrient()
      .resize({
        width: task.profile.width,
        height: task.profile.height,
        fit: task.profile.fit,
        position: task.profile.position,
        withoutEnlargement: false,
      })
      .webp({ quality: task.profile.quality })
      .toUint8Array();

    return moveWorkerSuccess(data, info, performance.now() - startedAt);
  } catch {
    return failure(IMAGE_PROCESSING_ERROR_CODES.INVALID_IMAGE, startedAt);
  }
}

export default processImageTask;
