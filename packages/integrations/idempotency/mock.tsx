import type { IdempotencyStore } from '@aolt/core/contracts';

export class MockIdempotencyStore implements IdempotencyStore {
  private readonly claims = new Map<string, number>();

  async begin(key: string, ttlSeconds: number) {
    const expiry = this.claims.get(key) || 0;
    if (expiry > Date.now()) return false;
    this.claims.set(key, Date.now() + ttlSeconds * 1000);
    return true;
  }

  async complete(key: string, ttlSeconds: number) {
    this.claims.set(key, Date.now() + ttlSeconds * 1000);
  }

  async release(key: string) {
    this.claims.delete(key);
  }
}
