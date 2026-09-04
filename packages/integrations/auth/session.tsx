import { randomBytes, timingSafeEqual } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { ApiRequest, ApiResponse } from '@aolt/core/api';
import { UserSchema, type User } from '@aolt/shared/contracts';
import { getServerEnv } from '@aolt/core/env';
import { AppError } from '@aolt/core/errors';
import {
  appendCookie,
  appendSetCookie,
  cookie,
  parseCookieHeader,
  parseCookies,
  serializeCookie
} from './cookies.js';

const PayloadSchema = UserSchema.omit({ id: true }).extend({
  sub: z.string().min(1),
  csrf: z.string().min(20)
});

export type SessionActor = User & { csrfToken: string };
export type JwtSessionUser = {
  id: string;
  email: string;
  name?: string;
  picture?: string;
};
export type JwtSessionSecret = string | Uint8Array;
export type JwtSessionManagerOptions<TUser extends JwtSessionUser> = {
  userSchema: z.ZodType<TUser>;
  getSecrets: () => JwtSessionSecret | readonly JwtSessionSecret[];
  getCookieName: () => string;
  getTtlSeconds: () => number;
  secureCookie?: () => boolean;
  sameSite?: 'Lax' | 'Strict' | 'None';
  path?: string;
  issuer?: string;
  audience?: string;
  keyId?: string;
};

function secretBytes(secret: JwtSessionSecret): Uint8Array {
  return typeof secret === 'string' ? new TextEncoder().encode(secret) : secret;
}

function secretList(secret: JwtSessionSecret | readonly JwtSessionSecret[]) {
  return (Array.isArray(secret) ? secret : [secret]).map(secretBytes);
}

export function createJwtSessionManager<TUser extends JwtSessionUser>(
  options: JwtSessionManagerOptions<TUser>
) {
  function secrets(): Uint8Array[] {
    return secretList(options.getSecrets());
  }

  async function createSessionToken(user: TUser): Promise<string> {
    const parsed = options.userSchema.parse(user);
    const now = Math.floor(Date.now() / 1000);
    const [primarySecret] = secrets();
    if (!primarySecret) {
      throw new Error('SESSION_SECRET is not configured.');
    }

    let token = new SignJWT({
      email: parsed.email,
      name: parsed.name,
      picture: parsed.picture
    })
      .setProtectedHeader({
        alg: 'HS256',
        ...(options.keyId ? { kid: options.keyId } : {})
      })
      .setSubject(parsed.id)
      .setIssuedAt(now)
      .setExpirationTime(now + options.getTtlSeconds());

    if (options.issuer) {
      token = token.setIssuer(options.issuer);
    }
    if (options.audience) {
      token = token.setAudience(options.audience);
    }

    return token.sign(primarySecret);
  }

  async function readSessionFromCookieHeader(
    cookieHeader: string | undefined
  ): Promise<TUser | null> {
    const token = parseCookieHeader(cookieHeader)[options.getCookieName()];
    if (!token) {
      return null;
    }

    for (const secret of secrets()) {
      try {
        const verified = await jwtVerify(token, secret, {
          algorithms: ['HS256'],
          ...(options.issuer ? { issuer: options.issuer } : {}),
          ...(options.audience ? { audience: options.audience } : {})
        });
        return options.userSchema.parse({
          id: verified.payload.sub,
          email: verified.payload.email,
          name: verified.payload.name,
          picture: verified.payload.picture
        });
      } catch {
        // Try the next secret during a rotation window.
      }
    }

    return null;
  }

  async function readSessionUser(req: ApiRequest): Promise<TUser | null> {
    return readSessionFromCookieHeader(req.headers.cookie);
  }

  async function setSessionCookie(res: ApiResponse, user: TUser) {
    appendSetCookie(
      res,
      serializeCookie(options.getCookieName(), await createSessionToken(user), {
        maxAge: options.getTtlSeconds(),
        secure: options.secureCookie?.() || false,
        sameSite: options.sameSite || 'Lax',
        httpOnly: true,
        path: options.path || '/'
      })
    );
  }

  function clearSessionCookie(res: ApiResponse) {
    appendSetCookie(
      res,
      serializeCookie(options.getCookieName(), '', {
        maxAge: 0,
        secure: options.secureCookie?.() || false,
        sameSite: options.sameSite || 'Lax',
        httpOnly: true,
        path: options.path || '/'
      })
    );
  }

  return {
    createSessionToken,
    readSessionFromCookieHeader,
    readSessionUser,
    setSessionCookie,
    clearSessionCookie
  };
}

function secrets(): Uint8Array[] {
  return getServerEnv()
    .SESSION_SECRETS.split(',')
    .map((value) => value.trim())
    .filter((value) => value.length >= 32)
    .map((value) => new TextEncoder().encode(value));
}

export function createCsrfToken(): string {
  return randomBytes(24).toString('base64url');
}

export async function createSessionToken(user: User, csrf = createCsrfToken()) {
  const env = getServerEnv();
  const parsed = UserSchema.parse(user);
  return new SignJWT({
    email: parsed.email,
    name: parsed.name,
    picture: parsed.picture,
    csrf
  })
    .setProtectedHeader({ alg: 'HS256', kid: '0' })
    .setSubject(parsed.id)
    .setIssuer('alpine-vercel-app-kit')
    .setAudience('alpine-vercel-app-kit')
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + env.SESSION_TTL_SECONDS)
    .sign(secrets()[0]);
}

export async function readSession(req: VercelRequest): Promise<SessionActor | null> {
  const env = getServerEnv();
  const token = parseCookies(req)[env.SESSION_COOKIE_NAME];
  if (!token) return null;
  for (const secret of secrets()) {
    try {
      const verified = await jwtVerify(token, secret, {
        algorithms: ['HS256'],
        issuer: 'alpine-vercel-app-kit',
        audience: 'alpine-vercel-app-kit'
      });
      const payload = PayloadSchema.parse(verified.payload);
      return {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        csrfToken: payload.csrf
      };
    } catch {
      // Try the previous key during a rotation window.
    }
  }
  return null;
}

export async function setSession(res: VercelResponse, user: User) {
  const env = getServerEnv();
  appendCookie(
    res,
    cookie(env.SESSION_COOKIE_NAME, await createSessionToken(user), {
      maxAge: env.SESSION_TTL_SECONDS
    })
  );
}

export function clearSession(res: VercelResponse) {
  appendCookie(res, cookie(getServerEnv().SESSION_COOKIE_NAME, '', { maxAge: 0 }));
}

export async function requireSession(req: VercelRequest): Promise<SessionActor> {
  const actor = await readSession(req);
  if (!actor) {
    throw new AppError('UNAUTHENTICATED', 'Authentication required.', 401);
  }
  return actor;
}

export function assertMutationRequest(req: VercelRequest, actor: SessionActor) {
  const expectedOrigin = new URL(getServerEnv().APP_BASE_URL).origin;
  const origin = String(req.headers.origin || '');
  if (origin && origin !== expectedOrigin) {
    throw new AppError('CSRF_REJECTED', 'Request origin was rejected.', 403);
  }
  const supplied = String(req.headers['x-csrf-token'] || '');
  try {
    if (
      !supplied ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(actor.csrfToken))
    ) {
      throw new Error('mismatch');
    }
  } catch {
    throw new AppError('CSRF_REJECTED', 'Request verification failed.', 403);
  }
}
