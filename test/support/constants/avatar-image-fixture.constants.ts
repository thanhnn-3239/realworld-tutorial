/**
 * Dimensions, colors, and timing values used by `avatar-image-fixture.factory.ts`.
 * Kept separate from the factory so every magic number driving a fixture's shape
 * is visible in one place, next to the profile limits it is designed to probe
 * (see `src/image-processing/constants/image-processing-profiles.constants.ts`:
 * `minShortestSide: 256`, `limitInputPixels: 16_000_000`).
 */

export const AVATAR_FIXTURE_BACKGROUND = {
  r: 30,
  g: 144,
  b: 255,
  alpha: 1,
} as const;

// A visibly different color for the animated fixture's second frame, so the
// two frames are not byte-identical copies of each other.
export const AVATAR_FIXTURE_SECOND_FRAME_BACKGROUND = {
  r: 255,
  g: 99,
  b: 71,
  alpha: 1,
} as const;

// Exactly the profile's `minShortestSide` — doubles as proof the boundary is
// inclusive (accepted), not just "large enough".
export const AVATAR_FIXTURE_VALID_SIDE = 256;

// One pixel below `minShortestSide` — must be rejected.
export const AVATAR_FIXTURE_TOO_SMALL_SIDE = 255;

// 4001 * 4000 = 16,004,000 px, just over the profile's 16,000,000 px limit.
export const AVATAR_FIXTURE_PIXEL_LIMIT_WIDTH = 4001;
export const AVATAR_FIXTURE_PIXEL_LIMIT_HEIGHT = 4000;

export const AVATAR_FIXTURE_ANIMATED_DELAYS_MS = [100, 100] as const;
export const AVATAR_FIXTURE_ANIMATED_LOOP = 0;

// EXIF orientation tag 6 = rotate 90° CW; exercises the worker's
// `autoOrient()` step the way a real camera photo would.
export const AVATAR_FIXTURE_EXIF_ORIENTATION = 6;

// Keeps enough JPEG header data for metadata(), but not enough scan data for decode.
export const AVATAR_FIXTURE_TRUNCATED_JPEG_LENGTH = 400;
