import type { ApiRequest, ApiResponse } from '@aolt/core/api';
import {
  type IncomingWhatsAppEvent,
  parseIncomingWhatsAppEvents,
  parseWebhookPayload,
  readWebhookRawBody,
  sendConfirmationButtons,
  sendTextMessage,
  verifyWebhookHandshake,
  verifyWebhookSignature
} from '../../server/whatsapp/cloudApi.js';
import {
  handleButtonReply,
  handleIncomingText
} from '../../server/whatsapp/leadCaptureService.js';
import {
  markMessageProcessed,
  removePendingLead,
  wasMessageProcessed
} from '../../server/whatsapp/pendingStore.js';
import { sendApiError } from '../../server/errors.js';

const MAX_LOG_IDENTIFIER_CHARS = 128;
// Coalesces overlapping deliveries only inside the current warm runtime.
const inFlightEvents = new Map<string, Promise<boolean>>();
const WEBHOOK_RETRY_HINT =
  'We could not finish that WhatsApp reply. Please resend the lead or tap Confirm again.';

export const config = {
  api: {
    bodyParser: false
  }
};

function boundedIdentifier(value: string): string {
  return String(value || '').slice(0, MAX_LOG_IDENTIFIER_CHARS);
}

function webhookLog(message: string, details?: Record<string, unknown>) {
  if (details) {
    console.log('[whatsapp-webhook]', message, details);
    return;
  }
  console.log('[whatsapp-webhook]', message);
}

async function notifyVolunteerToRetry(from: string): Promise<void> {
  try {
    await sendTextMessage(from, WEBHOOK_RETRY_HINT);
  } catch (error) {
    console.error('[whatsapp-webhook] retry notice failed', {
      from: boundedIdentifier(from),
      error: boundedIdentifier(error instanceof Error ? error.message : String(error))
    });
  }
}

async function processEventOnce(event: IncomingWhatsAppEvent): Promise<boolean> {
  try {
    if (event.type === 'text' && event.textBody) {
      const result = await handleIncomingText(
        event.from,
        event.textBody,
        event.messageId
      );

      if (result.action === 'show_confirmation' && result.parsed) {
        try {
          await sendConfirmationButtons(
            event.from,
            result.parsed,
            result.confirmationToken
          );
        } catch (error) {
          await removePendingLead(event.from);
          throw error;
        }
      } else if (result.action === 'send_text' && result.message) {
        await sendTextMessage(event.from, result.message);
      }
    } else if (event.type === 'button' && event.buttonReplyId) {
      const result = await handleButtonReply(event.from, event.buttonReplyId);
      const messages = result.messages?.length
        ? result.messages
        : result.message
          ? [result.message]
          : [];
      for (const message of messages) {
        await sendTextMessage(event.from, message);
      }
    }

    markMessageProcessed(event.messageId);
    return true;
  } catch (error) {
    console.error('[whatsapp-webhook] event processing failed', {
      messageId: boundedIdentifier(event.messageId),
      type: event.type,
      error: boundedIdentifier(error instanceof Error ? error.message : String(error))
    });
    await notifyVolunteerToRetry(event.from);
    return false;
  }
}

async function processEvent(event: IncomingWhatsAppEvent): Promise<boolean> {
  if (wasMessageProcessed(event.messageId)) {
    webhookLog('event_skipped', {
      messageId: boundedIdentifier(event.messageId),
      reason: 'duplicate'
    });
    return true;
  }

  const existing = inFlightEvents.get(event.messageId);
  if (existing) {
    webhookLog('event_coalesced', {
      messageId: boundedIdentifier(event.messageId),
      reason: 'duplicate_in_flight'
    });
    return existing;
  }

  const processing = processEventOnce(event);
  inFlightEvents.set(event.messageId, processing);
  try {
    return await processing;
  } finally {
    if (inFlightEvents.get(event.messageId) === processing) {
      inFlightEvents.delete(event.messageId);
    }
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const context = {
    route: String(req.method || 'UNKNOWN') + ' /api/seva/whatsapp/webhook',
    action: 'process_whatsapp_webhook',
    startedAt: Date.now(),
    messages: {
      validation: 'Invalid webhook request.',
      internal: 'Unable to process webhook request.'
    }
  };

  if (req.method === 'GET') {
    let verification: ReturnType<typeof verifyWebhookHandshake>;
    try {
      verification = verifyWebhookHandshake(req);
    } catch (error) {
      return sendApiError(res, error, context, {
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'Webhook verification is not configured.',
        retryable: false,
        category: 'configuration'
      });
    }
    if (!verification.ok) {
      return sendApiError(res, new Error('Invalid verification token.'), context, {
        status: 403,
        code: 'FORBIDDEN',
        message: 'Invalid webhook verification token.',
        retryable: false,
        category: 'authorization_denied'
      });
    }
    res.setHeader('Content-Type', 'text/plain');
    return res.end(verification.challenge);
  }

  if (req.method !== 'POST') {
    webhookLog('method_not_allowed', {
      method: boundedIdentifier(req.method || 'UNKNOWN')
    });
    res.setHeader('Allow', ['GET', 'POST']);
    return sendApiError(res, new Error('Method not allowed.'), context, {
      status: 405,
      code: 'METHOD_NOT_ALLOWED',
      message: 'Method not allowed.',
      retryable: false,
      category: 'method_not_allowed'
    });
  }

  let rawBody: Buffer;
  try {
    rawBody = await readWebhookRawBody(req);
  } catch (error) {
    webhookLog('invalid_body', {
      error: boundedIdentifier(error instanceof Error ? error.message : String(error))
    });
    return sendApiError(res, error, context, {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid webhook body.',
      retryable: false,
      category: 'validation'
    });
  }

  // Signature validation deliberately happens before parsing or logging payload content.
  let signatureValid: boolean;
  try {
    signatureValid = verifyWebhookSignature(req, rawBody);
  } catch (error) {
    return sendApiError(res, error, context, {
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Webhook signature verification is not configured.',
      retryable: false,
      category: 'configuration'
    });
  }
  if (!signatureValid) {
    webhookLog('invalid_signature');
    return sendApiError(res, new Error('Invalid webhook signature.'), context, {
      status: 403,
      code: 'FORBIDDEN',
      message: 'Invalid webhook signature.',
      retryable: false,
      category: 'authorization_denied'
    });
  }

  let payload: unknown;
  try {
    payload = parseWebhookPayload(req, rawBody);
  } catch (error) {
    return sendApiError(res, error, context, {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid webhook JSON.',
      retryable: false,
      category: 'validation'
    });
  }

  const events = parseIncomingWhatsAppEvents(payload);
  webhookLog('payload_accepted', {
    eventCount: events.length,
    senderCount: new Set(events.map((event) => event.from)).size,
    messageIds: events.slice(0, 10).map((event) => boundedIdentifier(event.messageId))
  });

  if (!events.length) {
    return res.status(200).json({ success: true, ignored: true });
  }

  // Always 200 after a valid payload so Meta does not replay work that may
  // already have been saved. Volunteer-visible retry text covers send failures.
  for (const event of events) {
    await processEvent(event);
  }

  return res.status(200).json({ success: true });
}
