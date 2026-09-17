import { randomUUID } from 'node:crypto';

export function buildStorageKey(folder: string, extension: string): string {
  const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
  const cleanExtension = extension.replace(/^\.+/, '').toLowerCase();
  if (!/^[a-z0-9]+$/.test(cleanExtension)) {
    throw new Error('Invalid storage extension');
  }
  return `${cleanFolder}/${randomUUID()}.${cleanExtension}`;
}
