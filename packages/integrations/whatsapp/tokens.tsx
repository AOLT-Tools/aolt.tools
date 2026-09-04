import { createHmac, timingSafeEqual } from 'node:crypto';
import { getWhatsAppEnv } from '@aolt/core/env';

export function signActionToken(
  action: string,
  subject: string,
  ttlSeconds = 300
): string {
  const payload = Buffer.from(
    JSON.stringify({
      action,
      subject,
      expiresAt: Date.now() + ttlSeconds * 1000
    })
  ).toString('base64url');
  const signature = createHmac('sha256', getWhatsAppEnv().META_APP_SECRET)
    .update(payload)
    .digest('base64url');
  return payload + '.' + signature;
}

export function readActionToken(
  token: string
): { action: string; subject: string } | null {
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return null;
  const expected = createHmac('sha256', getWhatsAppEnv().META_APP_SECRET)
    .update(payload)
    .digest('base64url');
  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
      action?: unknown;
      subject?: unknown;
      expiresAt?: unknown;
    };
    if (
      typeof value.action !== 'string' ||
      typeof value.subject !== 'string' ||
      typeof value.expiresAt !== 'number' ||
      value.expiresAt <= Date.now()
    ) {
      return null;
    }
    return { action: value.action, subject: value.subject };
  } catch {
    return null;
  }
}
