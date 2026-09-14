import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import Piscina from 'piscina';
import sharp from 'sharp';
import { IMAGE_PROCESSING_PROFILES } from '../src/image-processing/constants/image-processing-profiles.constants';
import type { ImageProcessingTask } from '../src/image-processing/interfaces/image-processing-task.interface';
import type { ImageProcessingWorkerResult } from '../src/image-processing/interfaces/image-processing-worker-result.interface';

// The real production artifact `PiscinaPoolService` loads at runtime — never the
// TypeScript source through ts-node/tsx. This test only exists to prove that file,
// once built by `pnpm build`, actually runs correctly inside a real worker thread.
const COMPILED_WORKER_PATH = resolve(
  process.cwd(),
  'dist/image-processing/workers/image-processing.worker.js',
);

async function createTestImage(
  width: number,
  height: number,
): Promise<Uint8Array> {
  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 120, g: 150, b: 200 },
    },
  })
    .png()
    .toBuffer();
  return new Uint8Array(buffer);
}

describe('compiled image processing worker (real Piscina)', () => {
  it('exists as a built JavaScript artifact, not the TypeScript source', () => {
    expect(existsSync(COMPILED_WORKER_PATH)).toBe(true);
    expect(COMPILED_WORKER_PATH.endsWith('.js')).toBe(true);
  });

  it('normalizes a real 256px image to 512x512 WebP through a real worker thread', async () => {
    const pool = new Piscina<ImageProcessingTask, ImageProcessingWorkerResult>({
      filename: COMPILED_WORKER_PATH,
    });

    try {
      const image = await createTestImage(256, 256);
      const task: ImageProcessingTask = {
        image,
        profile: IMAGE_PROCESSING_PROFILES.avatar,
      };

      const result = await pool.run(task, {
        transferList: [task.image.buffer as ArrayBuffer],
      });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error(`worker rejected the image: ${result.code}`);
      }

      expect(result.image).toMatchObject({
        format: 'webp',
        mimeType: 'image/webp',
        extension: 'webp',
        width: 512,
        height: 512,
      });

      await expect(sharp(result.image.data).metadata()).resolves.toMatchObject({
        format: 'webp',
        width: 512,
        height: 512,
      });
    } finally {
      await pool.close();
    }
  });
});
