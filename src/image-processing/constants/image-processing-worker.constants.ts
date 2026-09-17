import { extname, join } from 'node:path';

export const IMAGE_PROCESSING_WORKER_PATH_TOKEN = Symbol(
  'IMAGE_PROCESSING_WORKER_PATH',
);

export const COMPILED_IMAGE_PROCESSING_WORKER_PATH = join(
  __dirname,
  '../workers/image-processing.worker' + extname(__filename),
);
