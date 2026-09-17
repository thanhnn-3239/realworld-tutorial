export const USER_AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// GIF is deliberately excluded: the decoded-format check in image processing
// already rejects it, so the declared-MIME allowlist must match that gate
// instead of accepting a type that will only be rejected one step later.
export const ALLOWED_AVATAR_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];
