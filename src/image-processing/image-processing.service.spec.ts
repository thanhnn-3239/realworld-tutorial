import {
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PiscinaPoolService } from '../worker-pool/piscina-pool.service';
import { PiscinaPoolUnavailableError } from '../worker-pool/errors/piscina-pool-unavailable.error';
import { PiscinaTaskTimeoutError } from '../worker-pool/errors/piscina-task-timeout.error';
import { CustomLoggerService } from '../logger/logger.service';
import { ImageProcessingService } from './image-processing.service';
import { IMAGE_PROCESSING_ERROR_CODES } from './constants/image-processing-error-codes.constants';
import { IMAGE_PROCESSING_PROFILES } from './constants/image-processing-profiles.constants';
import {
  INVALID_IMAGE_MESSAGE,
  UNAVAILABLE_MESSAGE,
} from './constants/image-processing-response-messages.constants';
import type { ImageProcessingTask } from './interfaces/image-processing-task.interface';
import type { ProcessedImage } from './interfaces/processed-image.interface';
import type { ImageProcessingProfileName } from './types/image-processing-profile-name.type';

const WORKER_PATH =
  '/app/dist/image-processing/workers/image-processing.worker.js';
const processed: ProcessedImage = {
  data: new Uint8Array([1, 2, 3]),
  format: 'webp',
  mimeType: 'image/webp',
  extension: 'webp',
  width: 512,
  height: 512,
  size: 3,
};

describe('ImageProcessingService', () => {
  let pool: { run: jest.Mock };
  let logger: jest.Mocked<Pick<CustomLoggerService, 'log' | 'warn' | 'error'>>;
  let service: ImageProcessingService;

  beforeEach(() => {
    pool = { run: jest.fn() };
    logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    service = new ImageProcessingService(
      pool as unknown as PiscinaPoolService,
      logger as unknown as CustomLoggerService,
      WORKER_PATH,
    );
  });

  function resolveSuccess(): void {
    pool.run.mockResolvedValue({
      ok: true,
      image: processed,
      processingDurationMs: 12,
    });
  }

  it('returns the processed image and logs safe processing metrics', async () => {
    resolveSuccess();

    await expect(
      service.process(Buffer.from('some-avatar-bytes'), 'avatar'),
    ).resolves.toEqual(processed);

    expect(logger.log).toHaveBeenCalledWith(
      expect.stringMatching(
        /profile=avatar.*inputBytes=17.*outputBytes=3.*width=512.*height=512.*processingMs=/,
      ),
    );
    expect(logger.log.mock.calls[0]?.[0]).not.toContain('some-avatar-bytes');
  });

  it('dispatches an exact transferable copy to the trusted worker', async () => {
    resolveSuccess();
    const input = Buffer.from('some-avatar-bytes');

    await service.process(input, 'avatar');

    const [task, options] = pool.run.mock.calls[0] as [
      ImageProcessingTask,
      { workerPath: string; transferList: ArrayBuffer[] },
    ];
    expect(task.profile).toBe(IMAGE_PROCESSING_PROFILES.avatar);
    expect(task.image).toEqual(new Uint8Array(input));
    expect(task.image.byteOffset).toBe(0);
    expect(task.image.byteLength).toBe(input.length);
    expect(task.image.buffer).not.toBe(input.buffer);
    expect(options).toEqual({
      workerPath: WORKER_PATH,
      transferList: [task.image.buffer],
    });
  });

  it.each(Object.values(IMAGE_PROCESSING_ERROR_CODES))(
    'maps worker validation code %s to the fixed 422 response',
    async (code) => {
      pool.run.mockResolvedValue({ ok: false, code, processingDurationMs: 4 });

      await expect(service.process(Buffer.from('x'), 'avatar')).rejects.toEqual(
        new UnprocessableEntityException(INVALID_IMAGE_MESSAGE),
      );
    },
  );

  it('logs only the stable validation code', async () => {
    pool.run.mockResolvedValue({
      ok: false,
      code: IMAGE_PROCESSING_ERROR_CODES.INVALID_IMAGE,
      processingDurationMs: 4,
    });

    await service.process(Buffer.from('x'), 'avatar').catch(() => undefined);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('code=INVALID_IMAGE'),
    );
  });

  it.each([
    new PiscinaTaskTimeoutError(),
    new PiscinaPoolUnavailableError(),
    new Error('libvips: corrupt header at offset 12'),
  ])('maps %s to the fixed 503 response', async (error) => {
    pool.run.mockRejectedValue(error);

    await expect(service.process(Buffer.from('x'), 'avatar')).rejects.toEqual(
      new ServiceUnavailableException(UNAVAILABLE_MESSAGE),
    );
  });

  it('does not log native worker failure details', async () => {
    pool.run.mockRejectedValue(
      new Error('libvips: corrupt header at offset 12'),
    );

    await service.process(Buffer.from('x'), 'avatar').catch(() => undefined);

    const [message] = logger.error.mock.calls[0] as [string];
    expect(message).toContain('profile=avatar');
    expect(message).not.toMatch(/libvips|corrupt header/);
  });

  it('rejects an unknown profile before pool submission', async () => {
    await expect(
      service.process(
        Buffer.from('x'),
        'thumbnail' as unknown as ImageProcessingProfileName,
      ),
    ).rejects.toThrow('Unknown image processing profile: thumbnail');
    expect(pool.run).not.toHaveBeenCalled();
  });
});
