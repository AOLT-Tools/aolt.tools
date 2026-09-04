import { createHmac, timingSafeEqual } from 'node:crypto';
import type { VercelRequest } from '@vercel/node';
import type { ApiRequest } from '@aolt/core/api';
import { getWhatsAppEnv } from '@aolt/core/env';
import { AppError } from '@aolt/core/errors';
import { withTimeout } from '@aolt/core/retry';
import type { MessageProvider } from '@aolt/core/contracts';

export type WhatsAppEvent = {
  id: string;
  from: string;
  kind: 'text' | 'button';
  text: string;
};

export type IncomingWhatsAppEvent = {
  from: string;
  messageId: string;
  type: 'text' | 'button';
  textBody?: string;
  buttonReplyId?: string;
};

export type WhatsAppCloudCredentials = {
  accessToken: string;
  phoneNumberId: string;
  apiVersion: string;
};

export type WhatsAppCloudRequestOptions = {
  timeoutMs?: number;
  maxErrorBodyChars?: number;
};

type MetaPayload = {
  field?: string;
  value?: MetaChangeValue;
  entry?: Array<{
    changes?: Array<{
      value?: MetaChangeValue;
    }>;
  }>;
};

type MetaChangeValue = {
  messages?: Array<{
    id?: string;
    from?: string;
    type?: string;
    text?: { body?: string };
    interactive?: {
      button_reply?: {
        id?: string;
        title?: string;
      };
    };
  }>;
};

function extractChangeValues(body: MetaPayload): MetaChangeValue[] {
  const values: MetaChangeValue[] = [];

  if (body.value && Array.isArray(body.value.messages)) {
    values.push(body.value);
  }

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.value) {
        values.push(change.value);
      }
    }
  }

  return values;
}

export function parseWebhookPayload(rawBody: Uint8Array): unknown {
  const text = Buffer.from(rawBody).toString('utf8');
  return text ? (JSON.parse(text) as unknown) : {};
}

export function verifyMetaWebhookHandshake(
  req: ApiRequest,
  verifyToken: string
): {
  ok: boolean;
  challenge: string;
} {
  const mode = typeof req.query['hub.mode'] === 'string' ? req.query['hub.mode'] : '';
  const token =
    typeof req.query['hub.verify_token'] === 'string'
      ? req.query['hub.verify_token']
      : '';
  const challenge =
    typeof req.query['hub.challenge'] === 'string' ? req.query['hub.challenge'] : '';

  return {
    ok: mode === 'subscribe' && token === verifyToken,
    challenge
  };
}

export function verifyMetaWebhookSignature(
  signatureHeader: string | string[] | undefined,
  raw: Uint8Array,
  appSecret: string
): boolean {
  const supplied = Array.isArray(signatureHeader)
    ? signatureHeader[0]
    : signatureHeader;
  if (!supplied?.startsWith('sha256=')) {
    return false;
  }
  const expected =
    'sha256=' + createHmac('sha256', appSecret).update(raw).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function parseIncomingWhatsAppEvents(payload: unknown): IncomingWhatsAppEvent[] {
  const body = (payload || {}) as MetaPayload;
  const events: IncomingWhatsAppEvent[] = [];

  for (const value of extractChangeValues(body)) {
    for (const message of value.messages || []) {
      const from = String(message.from || '').trim();
      const messageId = String(message.id || '').trim();
      if (!from || !messageId) {
        continue;
      }

      if (message.type === 'text') {
        const textBody = String(message.text?.body || '').trim();
        if (textBody) {
          events.push({ from, messageId, type: 'text', textBody });
        }
        continue;
      }

      const buttonReplyId = String(message.interactive?.button_reply?.id || '').trim();
      if (message.type === 'interactive' && buttonReplyId) {
        events.push({ from, messageId, type: 'button', buttonReplyId });
      }
    }
  }

  return events;
}

export async function postToWhatsAppCloud(
  credentials: WhatsAppCloudCredentials,
  payload: unknown,
  options: WhatsAppCloudRequestOptions = {}
): Promise<void> {
  const timeoutMs = options.timeoutMs || 10_000;
  const maxErrorBodyChars = options.maxErrorBodyChars || 1_000;
  const url =
    'https://graph.facebook.com/' +
    credentials.apiVersion +
    '/' +
    credentials.phoneNumberId +
    '/messages';
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + credentials.accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: abortController.signal
    });
    if (!response.ok) {
      const text = (await response.text()).slice(0, maxErrorBodyChars);
      throw new Error('WhatsApp API error (' + String(response.status) + '): ' + text);
    }
  } catch (error) {
    if (abortController.signal.aborted) {
      throw new Error(`WhatsApp API request timed out after ${timeoutMs}ms.`, {
        cause: error
      });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendWhatsAppTextMessage(
  credentials: WhatsAppCloudCredentials,
  to: string,
  message: string,
  options: WhatsAppCloudRequestOptions = {}
): Promise<void> {
  await postToWhatsAppCloud(
    credentials,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: {
        body: message
      }
    },
    options
  );
}

export function verifyHandshake(req: VercelRequest) {
  const env = getWhatsAppEnv();
  const result = verifyMetaWebhookHandshake(
    req as unknown as ApiRequest,
    env.META_VERIFY_TOKEN
  );
  return {
    valid: result.ok,
    challenge: result.challenge
  };
}

export function verifySignature(
  signatureHeader: string | string[] | undefined,
  raw: Uint8Array
) {
  return verifyMetaWebhookSignature(
    signatureHeader,
    raw,
    getWhatsAppEnv().META_APP_SECRET
  );
}

export function parseEvents(payload: unknown): WhatsAppEvent[] {
  return parseIncomingWhatsAppEvents(payload).map((event) => ({
    id: event.messageId,
    from: event.from,
    kind: event.type,
    text: event.textBody || event.buttonReplyId || ''
  }));
}

export class WhatsAppCloudProvider implements MessageProvider {
  async sendText(to: string, text: string) {
    const env = getWhatsAppEnv();
    const response = await withTimeout(
      (signal) =>
        fetch(
          'https://graph.facebook.com/' +
            env.META_API_VERSION +
            '/' +
            env.META_PHONE_NUMBER_ID +
            '/messages',
          {
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + env.META_ACCESS_TOKEN,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to,
              type: 'text',
              text: { body: text }
            }),
            signal
          }
        ),
      10_000,
      'WhatsApp request timed out.'
    );
    if (!response.ok) {
      throw new AppError(
        'UPSTREAM_ERROR',
        'WhatsApp delivery failed.',
        503,
        response.status === 429 || response.status >= 500,
        'whatsapp_delivery'
      );
    }
  }
}
