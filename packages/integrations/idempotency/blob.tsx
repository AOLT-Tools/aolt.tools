import { del, head, put } from '@vercel/blob';
import type { IdempotencyStore } from '@aolt/core/contracts';
import { getServerEnv } from '@aolt/core/env';

function options() {
  const token = getServerEnv().BLOB_READ_WRITE_TOKEN;
  return token ? { token } : {};
}

export class BlobIdempotencyStore implements IdempotencyStore {
  private pathname(key: string) {
    const digest = Buffer.from(key).toString('base64url').slice(0, 180);
    return getServerEnv().BLOB_NAMESPACE + '/idempotency/' + digest + '.json';
  }

  async begin(key: string, ttlSeconds: number) {
    const pathname = this.pathname(key);
    try {
      const metadata = await head(pathname, options());
      if (Date.now() - metadata.uploadedAt.getTime() < ttlSeconds * 1000) {
        return false;
      }
      await del(pathname, options());
    } catch {
      // A missing marker is the expected first-delivery path.
    }
    try {
      await put(
        pathname,
        JSON.stringify({ state: 'processing', createdAt: new Date().toISOString() }),
        {
          access: 'private',
          contentType: 'application/json',
          addRandomSuffix: false,
          allowOverwrite: false,
          ...options()
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  async complete(key: string) {
    await put(
      this.pathname(key),
      JSON.stringify({ state: 'complete', completedAt: new Date().toISOString() }),
      {
        access: 'private',
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: true,
        ...options()
      }
    );
  }

  async release(key: string) {
    await del(this.pathname(key), options());
  }
}
