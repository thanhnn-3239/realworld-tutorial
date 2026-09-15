import sharp from 'sharp';
import { transferableSymbol, valueSymbol } from 'piscina';
import { processImageTask } from './image-processing.worker';
import { IMAGE_PROCESSING_PROFILES } from '../constants/image-processing-profiles.constants';
import { IMAGE_PROCESSING_ERROR_CODES } from '../constants/image-processing-error-codes.constants';
import type { ImageProcessingWorkerResult } from '../interfaces/image-processing-worker-result.interface';
import {
  createAnimatedWebp,
  createImage,
  createOrientedStripedJpeg,
  createSvg,
  createTruncatedJpeg,
  readPixel,
} from '../../../test/support/avatar-image-fixture.factory';

const profile = IMAGE_PROCESSING_PROFILES.avatar;

function unwrapWorkerResult(
  result: ImageProcessingWorkerResult,
): ImageProcessingWorkerResult {
  const wrapped = result as unknown as Record<PropertyKey, unknown>;
  return typeof wrapped === 'object' && valueSymbol in wrapped
    ? (wrapped[valueSymbol] as ImageProcessingWorkerResult)
    : result;
}

describe('processImageTask', () => {
  it.each(['jpeg', 'png', 'webp'] as const)(
    'normalizes %s to static 512x512 WebP',
    async (format) => {
      const image = await createImage({ format, width: 640, height: 480 });
      const rawResult = await processImageTask({ image, profile });
      const result = unwrapWorkerResult(rawResult);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.code);
      expect(result.image).toMatchObject({
        format: 'webp',
        mimeType: 'image/webp',
        extension: 'webp',
        width: 512,
        height: 512,
      });
      expect(
        (rawResult as unknown as Record<PropertyKey, unknown>)[
          transferableSymbol
        ],
      ).toEqual([result.image.data.buffer]);
      await expect(sharp(result.image.data).metadata()).resolves.toMatchObject({
        format: 'webp',
        width: 512,
        height: 512,
      });
    },
  );

  it('accepts a 256px shortest side and upscales it', async () => {
    const image = await createImage({ format: 'png', width: 256, height: 256 });
    const result = unwrapWorkerResult(
      await processImageTask({ image, profile }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.code);
    expect(result.image).toMatchObject({ width: 512, height: 512 });
  });

  it.each([
    [
      'a 255px shortest side',
      () => createImage({ format: 'png', width: 255, height: 255 }),
      IMAGE_PROCESSING_ERROR_CODES.IMAGE_TOO_SMALL,
    ] as const,
    [
      'more than 16,000,000 source pixels',
      () => createImage({ format: 'png', width: 4001, height: 4000 }),
      IMAGE_PROCESSING_ERROR_CODES.IMAGE_PIXEL_LIMIT_EXCEEDED,
    ] as const,
    [
      'GIF',
      () => createImage({ format: 'gif', width: 64, height: 64 }),
      IMAGE_PROCESSING_ERROR_CODES.UNSUPPORTED_IMAGE_FORMAT,
    ] as const,
    [
      'SVG',
      () => createSvg(),
      IMAGE_PROCESSING_ERROR_CODES.UNSUPPORTED_IMAGE_FORMAT,
    ] as const,
    [
      'animated WebP',
      () => createAnimatedWebp(),
      IMAGE_PROCESSING_ERROR_CODES.MULTI_FRAME_IMAGE,
    ] as const,
    [
      'malformed bytes',
      () => new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
      IMAGE_PROCESSING_ERROR_CODES.INVALID_IMAGE,
    ] as const,
  ])(
    'rejects %s',
    async (_label, createInput, expectedCode) => {
      const image = await createInput();
      const result = unwrapWorkerResult(
        await processImageTask({ image, profile }),
      );

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('expected rejection');
      expect(result.code).toBe(expectedCode);
    },
    20_000,
  );

  it('maps a truncated body with readable metadata to INVALID_IMAGE', async () => {
    const image = await createTruncatedJpeg();
    await expect(sharp(image).metadata()).resolves.toMatchObject({
      format: 'jpeg',
      width: 512,
      height: 512,
    });
    await expect(sharp(image).toBuffer()).rejects.toThrow();

    const result = unwrapWorkerResult(
      await processImageTask({ image, profile }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected rejection');
    expect(result.code).toBe(IMAGE_PROCESSING_ERROR_CODES.INVALID_IMAGE);
  });

  it('applies EXIF orientation before crop', async () => {
    const image = await createOrientedStripedJpeg(3);
    const result = unwrapWorkerResult(
      await processImageTask({ image, profile }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.code);
    const top = await readPixel(result.image.data, 256, 50);
    const bottom = await readPixel(result.image.data, 256, 460);
    expect(top.b).toBeGreaterThan(top.r);
    expect(bottom.r).toBeGreaterThan(bottom.b);
  });

  it('strips EXIF, XMP, IPTC, and ICC metadata', async () => {
    const image = await createOrientedStripedJpeg(3);
    const result = unwrapWorkerResult(
      await processImageTask({ image, profile }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.code);
    const metadata = await sharp(result.image.data).metadata();
    expect(metadata.exif).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
    expect(metadata.iptc).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
  });
});
