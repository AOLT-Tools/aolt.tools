import {
  getWhatsAppMessagingEnv,
  getWhatsAppSignatureEnv,
  getWhatsAppVerifyEnv
} from '../env.js';
import { bodyAsBuffer, readRawBody, type ApiRequest } from '@aolt/core/api';
import {
  parseIncomingWhatsAppEvents,
  parseWebhookPayload as parseMetaWebhookPayload,
  postToWhatsAppCloud,
  sendWhatsAppTextMessage,
  verifyMetaWebhookHandshake,
  verifyMetaWebhookSignature,
  type IncomingWhatsAppEvent,
  type WhatsAppCloudCredentials
} from '@aolt/integrations/whatsapp/cloud';
import type { ParsedLeadMessage } from './leadParser.js';
import { buildConfirmationButtonId } from './confirmationToken.js';

const META_REQUEST_TIMEOUT_MS = 10_000;
const MAX_META_ERROR_BODY_CHARS = 1_000;
const MAX_WEBHOOK_BODY_BYTES = 1_000_000;
const WHATSAPP_REQUEST_OPTIONS = {
  timeoutMs: META_REQUEST_TIMEOUT_MS,
  maxErrorBodyChars: MAX_META_ERROR_BODY_CHARS
};

export type { IncomingWhatsAppEvent };
export { parseIncomingWhatsAppEvents };

function getMessagingCredentials(): WhatsAppCloudCredentials {
  const env = getWhatsAppMessagingEnv();
  return {
    accessToken: env.META_ACCESS_TOKEN,
    phoneNumberId: env.META_PHONE_NUMBER_ID,
    apiVersion: env.META_API_VERSION
  };
}

export async function readWebhookRawBody(req: ApiRequest): Promise<Buffer> {
  try {
    return await readRawBody(req, MAX_WEBHOOK_BODY_BYTES);
  } catch (error) {
    if (error instanceof Error && error.message === 'REQUEST_BODY_TOO_LARGE') {
      throw new Error('WHATSAPP_WEBHOOK_BODY_TOO_LARGE', { cause: error });
    }
    throw error;
  }
}

export function parseWebhookPayload(_req: ApiRequest, rawBody: Uint8Array): unknown {
  return parseMetaWebhookPayload(rawBody);
}

export function verifyWebhookHandshake(req: ApiRequest): {
  ok: boolean;
  challenge: string;
} {
  return verifyMetaWebhookHandshake(req, getWhatsAppVerifyEnv().META_VERIFY_TOKEN);
}

export function verifyWebhookSignature(
  req: ApiRequest,
  rawBody: Uint8Array = bodyAsBuffer(req.body)
): boolean {
  return verifyMetaWebhookSignature(
    req.headers['x-hub-signature-256'],
    rawBody,
    getWhatsAppSignatureEnv().META_APP_SECRET
  );
}

async function postToWhatsApp(payload: unknown): Promise<void> {
  await postToWhatsAppCloud(
    getMessagingCredentials(),
    payload,
    WHATSAPP_REQUEST_OPTIONS
  );
}

export async function sendTextMessage(to: string, message: string): Promise<void> {
  await sendWhatsAppTextMessage(
    getMessagingCredentials(),
    to,
    message,
    WHATSAPP_REQUEST_OPTIONS
  );
}

export async function sendConfirmationButtons(
  to: string,
  parsed: ParsedLeadMessage,
  confirmationToken = ''
): Promise<void> {
  const details = [
    '📋 Please confirm the extracted details',
    '',
    '👤 Name      : ' + (parsed.name || '-'),
    '📱 Mobile    : ' + (parsed.mobile || '-'),
    '📘 Course    : ' + (parsed.course || '-'),
    '🔥 Quality   : ' + (parsed.leadQuality || '-'),
    '📅 Month     : ' + (parsed.month || '-'),
    '📝 Notes     : ' + (parsed.notes || '-')
  ].join('\n');

  await postToWhatsApp({
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: details
      },
      action: {
        buttons: [
          {
            type: 'reply',
            reply: {
              id: buildConfirmationButtonId('confirm_save', confirmationToken),
              title: '✅ Confirm & Save'
            }
          },
          {
            type: 'reply',
            reply: {
              id: buildConfirmationButtonId('edit_lead', confirmationToken),
              title: '✏️ Edit'
            }
          }
        ]
      }
    }
  });
}
