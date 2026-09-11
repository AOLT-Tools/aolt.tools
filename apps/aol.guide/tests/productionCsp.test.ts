import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const vercel = JSON.parse(
  readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')
) as {
  headers: Array<{
    headers: Array<{ key: string; value: string }>;
  }>;
};

function header(name: string): string {
  for (const block of vercel.headers) {
    for (const entry of block.headers) {
      if (entry.key === name) return entry.value;
    }
  }
  return '';
}

describe('production Mapbox CSP', () => {
  const csp = header('Content-Security-Policy');

  it('lets the Search Box call Mapbox without loading a third-party script', () => {
    expect(csp).toContain("connect-src 'self' https://api.mapbox.com https://events.mapbox.com");
    expect(csp).toContain('worker-src blob:');
    expect(csp).toContain('blob:');
    expect(csp).toMatch(/script-src 'self'(;|$)/);
  });
});
