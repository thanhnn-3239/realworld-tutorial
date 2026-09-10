import { randomUUID } from 'node:crypto';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'application/zip': 'zip',
};

export function getExtensionFromMime(
  mimeType: string,
  originalname?: string,
): string {
  if (MIME_TO_EXT[mimeType]) {
    return MIME_TO_EXT[mimeType];
  }
  if (originalname && originalname.includes('.')) {
    const ext = originalname.split('.').pop()?.toLowerCase();
    if (ext && /^[a-z0-9]+$/.test(ext)) {
      return ext;
    }
  }
  return 'bin';
}

export function buildStorageKey(
  folder: string,
  file: Express.Multer.File,
): string {
  const ext = getExtensionFromMime(file.mimetype, file.originalname);
  const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
  return `${cleanFolder}/${randomUUID()}.${ext}`;
}
