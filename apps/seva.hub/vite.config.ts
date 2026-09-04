import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { mockCourses } from './src/repositories/mock/mockCourses.ts';
import {
  DEFAULT_CENTER_WHATSAPP_NUMBER,
  homepageProgramOffers,
  selectActivePublicCourses
} from './shared/contracts/courseDefaults.mjs';
import {
  renderPublicCourseHtml,
  toPublicCourseView
} from './server/courses/publicHtml.ts';

const appDir = import.meta.dirname;
const repoDir = resolve(appDir, '../..');
const outputDir = resolve(appDir, 'dist');
const COURSE_IMAGE_PATH = /^\/course\/([^/?#]+)\/image\/?$/;

type MiddlewareRes = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body?: string | Buffer) => void;
};

function servePublicCourseCatalog(
  url: string | undefined,
  res: MiddlewareRes
): boolean {
  const raw = String(url || '');
  const queryIndex = raw.indexOf('?');
  const pathname = queryIndex >= 0 ? raw.slice(0, queryIndex) : raw;
  const query = queryIndex >= 0 ? raw.slice(queryIndex + 1) : '';
  const isCourseCatalogPath =
    pathname === '/api/seva/courses' || pathname === '/api/seva/courses/';
  if (!isCourseCatalogPath) {
    return false;
  }

  const params = new URLSearchParams(query);
  if (params.get('catalog') !== '1') {
    return false;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.end(
    JSON.stringify({
      success: true,
      offers: homepageProgramOffers(mockCourses),
      whatsappNumber: DEFAULT_CENTER_WHATSAPP_NUMBER
    })
  );
  return true;
}

function servePublicCourseImage(url: string | undefined, res: MiddlewareRes): boolean {
  const pathname = String(url || '').split('?')[0];
  const match = pathname.match(COURSE_IMAGE_PATH);
  if (!match) {
    return false;
  }

  const key = decodeURIComponent(match[1] || '');
  const course = mockCourses.find((item) => item.id === key);
  if (!course?.hasImage) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Image not found.');
    return true;
  }

  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end('Image not found.');
  return true;
}

function servePublicCoursesPage(
  url: string | undefined,
  host: string | string[] | undefined,
  res: MiddlewareRes
): boolean {
  const requestUrl = new URL(String(url || ''), 'http://localhost');
  if (requestUrl.pathname !== '/courses') {
    return false;
  }

  const programKey = requestUrl.searchParams.get('program') || '';
  const hostname = Array.isArray(host) ? host[0] : host || 'localhost:5173';
  const origin = 'http://' + hostname;
  const page = selectActivePublicCourses(mockCourses, programKey);
  const courses = page.courses.map((course) => toPublicCourseView(course));
  const selected = page.selected
    ? toPublicCourseView(page.selected)
    : courses[0] || null;
  const rendered = renderPublicCourseHtml({
    selected,
    courses,
    origin,
    programKey: page.selectionMatched ? programKey : ''
  });
  res.statusCode = rendered.status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(rendered.html);
  return true;
}

function sevaHubRewritePlugin() {
  const rewriteStaticUrl = (url?: string) => {
    if (!url) {
      return url;
    }

    const queryIndex = url.indexOf('?');
    const pathname = queryIndex >= 0 ? url.slice(0, queryIndex) : url;
    const query = queryIndex >= 0 ? url.slice(queryIndex) : '';

    if (pathname === '/seva' || pathname === '/seva/') {
      return `/seva.html${query}`;
    }
    if (pathname === '/privacy' || pathname === '/privacy/') {
      return `/privacy.html${query}`;
    }
    if (pathname === '/terms' || pathname === '/terms/') {
      return `/terms.html${query}`;
    }
    return url;
  };

  const middleware = (
    req: { url?: string; headers?: { host?: string | string[] } },
    res: MiddlewareRes,
    next: () => void
  ) => {
    if (servePublicCourseCatalog(req.url, res)) {
      return;
    }
    if (servePublicCourseImage(req.url, res)) {
      return;
    }
    if (servePublicCoursesPage(req.url, req.headers?.host, res)) {
      return;
    }
    req.url = rewriteStaticUrl(req.url);
    next();
  };

  return {
    name: 'seva-hub-rewrites',
    configureServer(server: {
      middlewares: {
        use: (handler: typeof middleware) => void;
      };
    }) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server: {
      middlewares: {
        use: (handler: typeof middleware) => void;
      };
    }) {
      server.middlewares.use(middleware);
    }
  };
}

export default defineConfig({
  root: resolve(appDir, 'src'),
  publicDir: resolve(appDir, 'public'),
  plugins: [tailwindcss(), sevaHubRewritePlugin()],
  server: {
    fs: {
      allow: [repoDir]
    }
  },
  build: {
    outDir: outputDir,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(appDir, 'src/index.html'),
        seva: resolve(appDir, 'src/seva.html'),
        privacy: resolve(appDir, 'src/privacy.html'),
        terms: resolve(appDir, 'src/terms.html')
      }
    }
  }
});
