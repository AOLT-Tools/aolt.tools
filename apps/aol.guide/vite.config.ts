import { resolve } from 'node:path';
import type { IncomingMessage, ServerResponse as NodeResponse } from 'node:http';
import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';

const appDir = import.meta.dirname;
const repoDir = resolve(appDir, '../..');

export default defineConfig({
  root: resolve(appDir, 'src'),
  publicDir: resolve(appDir, 'public'),
  plugins: [
    tailwindcss(),
    {
      name: 'aol-guide-search-api',
      configureServer(server) {
        attachSearchApi(server);
      },
      configurePreviewServer(server) {
        attachSearchApi(server);
      }
    }
  ],
  server: {
    fs: {
      allow: [repoDir]
    }
  },
  build: {
    outDir: resolve(appDir, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(appDir, 'src/index.html')
      },
      output: {
        entryFileNames: 'assets/aol-guide/[name]-[hash].js',
        chunkFileNames: 'assets/aol-guide/[name]-[hash].js',
        assetFileNames: 'assets/aol-guide/[name]-[hash][extname]'
      }
    }
  },
  test: {
    root: appDir,
    include: ['tests/**/*.test.ts'],
    environment: 'node'
  }
});

function attachSearchApi(server: {
  middlewares: {
    use: (
      handler: (req: IncomingMessage, res: NodeResponse, next: () => void) => void
    ) => void;
  };
}) {
  server.middlewares.use(async (req, res, next) => {
    const url = req.url?.split('?')[0] || '';
    if (url !== '/api/search' && url !== '/api/aol-guide/search') {
      next();
      return;
    }
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ success: false, error: { message: 'Use POST.' } }));
      return;
    }

    try {
      const body = JSON.parse(await readBody(req));
      const query = String(body.query || '').trim();
      if (!query) {
        res.statusCode = 400;
        res.setHeader('content-type', 'application/json');
        res.end(
          JSON.stringify({ success: false, error: { message: 'Query is required.' } })
        );
        return;
      }
      const { createOfficialSearchService } = await import('./lib/factory.ts');
      const result = await createOfficialSearchService().search(query);
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.setHeader('cache-control', 'no-store');
      res.end(JSON.stringify({ success: true, ...result }));
    } catch (error) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          success: false,
          error: {
            message: error instanceof Error ? error.message : 'Search failed.'
          }
        })
      );
    }
  });
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8') || '{}'));
    req.on('error', reject);
  });
}
