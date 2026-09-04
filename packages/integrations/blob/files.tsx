import { AppError } from '@aolt/core/errors';

const allowedTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf'
]);

function hasMagic(bytes: Uint8Array, expected: readonly number[]): boolean {
  return expected.every((value, index) => bytes[index] === value);
}

export function validateUpload(
  bytes: Uint8Array,
  contentType: string,
  maxBytes: number
) {
  if (!bytes.byteLength || bytes.byteLength > maxBytes) {
    throw new AppError(
      'VALIDATION_ERROR',
      'File is empty or exceeds the configured size limit.',
      400
    );
  }
  if (!allowedTypes.has(contentType)) {
    throw new AppError('VALIDATION_ERROR', 'File type is not allowed.', 400);
  }
  const valid =
    (contentType === 'image/jpeg' && hasMagic(bytes, [0xff, 0xd8, 0xff])) ||
    (contentType === 'image/png' &&
      hasMagic(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    (contentType === 'image/webp' &&
      hasMagic(bytes, [0x52, 0x49, 0x46, 0x46]) &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') ||
    (contentType === 'application/pdf' &&
      String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-');
  if (!valid) {
    throw new AppError(
      'VALIDATION_ERROR',
      'File content does not match its declared type.',
      400
    );
  }
}

export function safeFilename(value: string): string {
  const normalized = String(value || 'upload')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
  return normalized || 'upload';
}
