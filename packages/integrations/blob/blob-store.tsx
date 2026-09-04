import { del, list, put } from '@vercel/blob';
import type { BlobStore, StoredBlob } from '@aolt/core/contracts';
import { getServerEnv } from '@aolt/core/env';
import { AppError } from '@aolt/core/errors';
import { withTimeout } from '@aolt/core/retry';

function tokenOptions() {
  const token = getServerEnv().BLOB_READ_WRITE_TOKEN;
  return token ? { token } : {};
}

export class VercelBlobStore implements BlobStore {
  async put(pathname: string, bytes: Uint8Array, contentType: string) {
    const env = getServerEnv();
    try {
      const result = await withTimeout(
        () =>
          put(pathname, Buffer.from(bytes), {
            access: env.BLOB_ACCESS,
            contentType,
            addRandomSuffix: true,
            ...tokenOptions()
          }),
        20_000,
        'Blob upload timed out.'
      );
      return {
        pathname: result.pathname,
        url: result.url,
        contentType: result.contentType,
        size: bytes.byteLength
      };
    } catch (error) {
      throw new AppError(
        'UPSTREAM_ERROR',
        'File storage is unavailable.',
        503,
        true,
        'blob_upload',
        { cause: error }
      );
    }
  }

  async delete(pathnameOrUrl: string) {
    try {
      await withTimeout(
        () => del(pathnameOrUrl, tokenOptions()),
        10_000,
        'Blob deletion timed out.'
      );
    } catch (error) {
      throw new AppError(
        'UPSTREAM_ERROR',
        'File cleanup could not be completed.',
        503,
        true,
        'blob_delete',
        { cause: error }
      );
    }
  }

  async list(prefix: string): Promise<StoredBlob[]> {
    const values: StoredBlob[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, cursor, limit: 1000, ...tokenOptions() });
      values.push(
        ...page.blobs.map((blob) => ({
          pathname: blob.pathname,
          url: blob.url,
          contentType: 'application/octet-stream',
          size: blob.size
        }))
      );
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return values;
  }
}
