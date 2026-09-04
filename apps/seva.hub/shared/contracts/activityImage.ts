export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const IMAGE_SIZE_ERROR = 'Image must be < 3 MB';
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp'
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export function isAllowedImageMimeType(value: string): value is AllowedImageMimeType {
  return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(
    String(value || '')
      .trim()
      .toLowerCase()
  );
}

export function imageByteLengthFromBase64(base64: string): number {
  const raw = String(base64 || '').replace(/\s+/g, '');
  if (!raw) {
    return 0;
  }
  const padding = raw.endsWith('==') ? 2 : raw.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((raw.length * 3) / 4) - padding);
}

export function inspectImageUpload(
  base64: string,
  mimeType: string
): { ok: true } | { ok: false; message: string } {
  const mime = String(mimeType || '')
    .trim()
    .toLowerCase();
  if (!isAllowedImageMimeType(mime)) {
    return {
      ok: false,
      message: 'Image must be a JPEG, PNG, or WebP image.'
    };
  }
  if (imageByteLengthFromBase64(base64) >= MAX_IMAGE_BYTES) {
    return {
      ok: false,
      message: IMAGE_SIZE_ERROR
    };
  }
  if (!String(base64 || '').trim()) {
    return {
      ok: false,
      message: 'Choose an activity image to upload.'
    };
  }
  return { ok: true };
}
