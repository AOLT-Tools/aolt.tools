import { createHmac, timingSafeEqual } from 'node:crypto';
import { deflateRawSync, inflateRawSync } from 'node:zlib';

const DEFAULT_SIGNATURE_BYTES = 12;
const DEFAULT_MAX_INFLATED_TOKEN_BYTES = 8_192;

export type ParsedActionButtonId<TAction extends string> = {
  action: TAction;
  token: string;
};

export type SignedCompressedTokenOptions = {
  secret: string;
  signatureBytes?: number;
  maxInflatedBytes?: number;
};

function sign(encodedPayload: string, secret: string, signatureBytes: number): string {
  return createHmac('sha256', secret)
    .update(encodedPayload)
    .digest()
    .subarray(0, signatureBytes)
    .toString('base64url');
}

export function createSignedCompressedToken(
  payload: readonly string[],
  options: SignedCompressedTokenOptions
): string {
  const signatureBytes = options.signatureBytes || DEFAULT_SIGNATURE_BYTES;
  const encodedPayload = deflateRawSync(Buffer.from(JSON.stringify(payload))).toString(
    'base64url'
  );
  return `${encodedPayload}.${sign(encodedPayload, options.secret, signatureBytes)}`;
}

export function readSignedCompressedToken(
  token: string,
  options: SignedCompressedTokenOptions
): string[] | null {
  const signatureBytes = options.signatureBytes || DEFAULT_SIGNATURE_BYTES;
  const maxInflatedBytes = options.maxInflatedBytes || DEFAULT_MAX_INFLATED_TOKEN_BYTES;
  const [encodedPayload, suppliedSignature, extra] = String(token || '').split('.');
  if (!encodedPayload || !suppliedSignature || extra) {
    return null;
  }

  const expectedSignature = sign(encodedPayload, options.secret, signatureBytes);
  try {
    if (
      !timingSafeEqual(Buffer.from(suppliedSignature), Buffer.from(expectedSignature))
    ) {
      return null;
    }
  } catch {
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(
      inflateRawSync(Buffer.from(encodedPayload, 'base64url'), {
        maxOutputLength: maxInflatedBytes
      }).toString('utf8')
    ) as unknown;
  } catch {
    return null;
  }

  return Array.isArray(payload) && payload.every((value) => typeof value === 'string')
    ? payload
    : null;
}

export function buildActionButtonId<TAction extends string>(
  action: TAction,
  token = ''
): string {
  return token ? `${action}.${token}` : action;
}

export function actionButtonIdFits<TAction extends string>(
  action: TAction,
  token: string,
  maxChars: number
): boolean {
  return buildActionButtonId(action, token).length <= maxChars;
}

export function parseActionButtonId<TAction extends string>(
  buttonIdValue: string,
  actions: readonly TAction[]
): ParsedActionButtonId<TAction> | null {
  const value = String(buttonIdValue || '').trim();
  for (const action of actions) {
    if (value === action) {
      return { action, token: '' };
    }
    const prefix = `${action}.`;
    if (value.startsWith(prefix)) {
      return { action, token: value.slice(prefix.length) };
    }
  }
  return null;
}
