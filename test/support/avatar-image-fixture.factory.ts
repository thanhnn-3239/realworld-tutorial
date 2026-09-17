import sharp from 'sharp';
import { USER_AVATAR_MAX_SIZE_BYTES } from '../../src/users/constants/avatar-upload.constants';
import {
  AVATAR_FIXTURE_ANIMATED_DELAYS_MS,
  AVATAR_FIXTURE_ANIMATED_LOOP,
  AVATAR_FIXTURE_BACKGROUND,
  AVATAR_FIXTURE_EXIF_ORIENTATION,
  AVATAR_FIXTURE_PIXEL_LIMIT_HEIGHT,
  AVATAR_FIXTURE_PIXEL_LIMIT_WIDTH,
  AVATAR_FIXTURE_SECOND_FRAME_BACKGROUND,
  AVATAR_FIXTURE_TOO_SMALL_SIDE,
  AVATAR_FIXTURE_TRUNCATED_JPEG_LENGTH,
  AVATAR_FIXTURE_VALID_SIDE,
} from './constants/avatar-image-fixture.constants';
import type { AvatarImageFixtureSet } from './interfaces/avatar-image-fixture-set.interface';

export type { AvatarImageFixtureSet } from './interfaces/avatar-image-fixture-set.interface';

export async function createImage({
  format,
  width,
  height,
  background = AVATAR_FIXTURE_BACKGROUND,
  orientation,
}: {
  format: 'jpeg' | 'png' | 'webp' | 'gif';
  width: number;
  height: number;
  background?: sharp.Color;
  orientation?: number;
}): Promise<Buffer> {
  const image = sharp({
    create: { width, height, channels: 3, background },
  }).toFormat(format);

  return orientation
    ? image.withMetadata({ orientation }).toBuffer()
    : image.toBuffer();
}

export async function createAnimatedWebp(
  side = 8,
  firstBackground: sharp.Color = 'red',
  secondBackground: sharp.Color = 'blue',
): Promise<Buffer> {
  const frames = await Promise.all([
    createImage({
      format: 'png',
      width: side,
      height: side,
      background: firstBackground,
    }),
    createImage({
      format: 'png',
      width: side,
      height: side,
      background: secondBackground,
    }),
  ]);

  return sharp(frames, { join: { animated: true } })
    .webp({
      loop: AVATAR_FIXTURE_ANIMATED_LOOP,
      delay: [...AVATAR_FIXTURE_ANIMATED_DELAYS_MS],
    })
    .toBuffer();
}

export function createSvg(side = 300): Buffer {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}">` +
      '<rect width="100%" height="100%" fill="red"/></svg>',
  );
}

export async function createTruncatedJpeg(): Promise<Buffer> {
  const image = await createImage({
    format: 'jpeg',
    width: 512,
    height: 512,
  });
  return image.subarray(0, AVATAR_FIXTURE_TRUNCATED_JPEG_LENGTH);
}

export async function createOrientedStripedJpeg(
  orientation: number,
): Promise<Buffer> {
  const width = 300;
  const height = 300;
  const raw = Buffer.alloc(width * height * 3);

  for (let y = 0; y < height; y += 1) {
    const [r, g, b] = y < height / 2 ? [255, 0, 0] : [0, 0, 255];
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 3;
      raw[index] = r;
      raw[index + 1] = g;
      raw[index + 2] = b;
    }
  }

  return sharp(raw, { raw: { width, height, channels: 3 } })
    .jpeg()
    .withMetadata({ orientation })
    .toBuffer();
}

export async function readPixel(
  webpData: Uint8Array,
  x: number,
  y: number,
): Promise<{ r: number; g: number; b: number }> {
  const { data, info } = await sharp(webpData)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const index = (y * info.width + x) * info.channels;
  return { r: data[index], g: data[index + 1], b: data[index + 2] };
}

export async function createValidAvatarFixture(): Promise<Buffer> {
  return createImage({
    format: 'png',
    width: AVATAR_FIXTURE_VALID_SIDE,
    height: AVATAR_FIXTURE_VALID_SIDE,
  });
}

export async function createAvatarImageFixtureSet(): Promise<AvatarImageFixtureSet> {
  const side = AVATAR_FIXTURE_VALID_SIDE;
  const [jpeg, png, webp, gif, animatedWebp, tooSmallPng, pixelLimitPng] =
    await Promise.all([
      createImage({
        format: 'jpeg',
        width: side,
        height: side,
        orientation: AVATAR_FIXTURE_EXIF_ORIENTATION,
      }),
      createValidAvatarFixture(),
      createImage({ format: 'webp', width: side, height: side }),
      createImage({ format: 'gif', width: side, height: side }),
      createAnimatedWebp(
        side,
        AVATAR_FIXTURE_BACKGROUND,
        AVATAR_FIXTURE_SECOND_FRAME_BACKGROUND,
      ),
      createImage({
        format: 'png',
        width: AVATAR_FIXTURE_TOO_SMALL_SIDE,
        height: AVATAR_FIXTURE_TOO_SMALL_SIDE,
      }),
      createImage({
        format: 'png',
        width: AVATAR_FIXTURE_PIXEL_LIMIT_WIDTH,
        height: AVATAR_FIXTURE_PIXEL_LIMIT_HEIGHT,
      }),
    ]);

  return {
    jpeg,
    png,
    webp,
    gif,
    svg: createSvg(side),
    animatedWebp,
    tooSmallPng,
    pixelLimitPng,
    textAsPng: Buffer.from('not a real image'),
    oversizedPng: Buffer.alloc(USER_AVATAR_MAX_SIZE_BYTES + 1),
  };
}
