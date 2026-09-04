import type { VercelRequest, VercelResponse } from '@vercel/node';

export type CookieResponse = {
  setHeader: (name: string, value: string | string[]) => void;
  getHeader: (name: string) => number | string | string[] | undefined;
};

export type CookieOptions = {
  maxAge?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Lax' | 'Strict' | 'None';
  path?: string;
};

export function parseCookieHeader(
  cookieHeader: string | undefined
): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, part) => {
      const index = part.indexOf('=');
      if (index <= 0) {
        return acc;
      }
      const key = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();
      try {
        acc[key] = decodeURIComponent(value);
      } catch {
        // Ignore a malformed cookie while treating the request as anonymous.
      }
      return acc;
    }, {});
}

export function parseCookies(req: VercelRequest): Record<string, string> {
  return parseCookieHeader(req.headers.cookie);
}

export function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions = {}
): string {
  const segments = [name + '=' + encodeURIComponent(value)];
  segments.push('Path=' + (options.path || '/'));

  if (typeof options.maxAge === 'number') {
    segments.push('Max-Age=' + Math.floor(options.maxAge));
  }
  if (options.httpOnly !== false) {
    segments.push('HttpOnly');
  }
  if (options.secure) {
    segments.push('Secure');
  }
  segments.push('SameSite=' + (options.sameSite || 'Lax'));

  return segments.join('; ');
}

export function cookie(
  name: string,
  value: string,
  options: { maxAge: number; httpOnly?: boolean }
): string {
  return serializeCookie(name, value, {
    maxAge: options.maxAge,
    httpOnly: options.httpOnly,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/'
  });
}

export function appendSetCookie(res: CookieResponse, value: string) {
  const current = res.getHeader('Set-Cookie');
  if (!current) {
    res.setHeader('Set-Cookie', [value]);
    return;
  }

  if (Array.isArray(current)) {
    res.setHeader('Set-Cookie', [...current, value]);
    return;
  }

  res.setHeader('Set-Cookie', [String(current), value]);
}

export function appendCookie(res: VercelResponse, value: string) {
  appendSetCookie(res, value);
}
