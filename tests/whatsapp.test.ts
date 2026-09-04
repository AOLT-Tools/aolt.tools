import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { __resetEnvForTests } from '@aolt/core/env';
import { MockIdempotencyStore } from '@aolt/integrations/idempotency/mock';
import {
  actionButtonIdFits,
  buildActionButtonId,
  createSignedCompressedToken,
  parseActionButtonId,
  readSignedCompressedToken
} from '@aolt/integrations/whatsapp/action-tokens';
import {
  parseEvents,
  parseIncomingWhatsAppEvents,
  verifySignature
} from '@aolt/integrations/whatsapp/cloud';

beforeEach(() => {
  process.env.META_APP_SECRET = 'meta-app-secret';
  process.env.META_VERIFY_TOKEN = 'verify';
  process.env.META_ACCESS_TOKEN = 'access';
  process.env.META_PHONE_NUMBER_ID = 'phone';
  __resetEnvForTests();
});

describe('WhatsApp webhook pipeline', () => {
  it('verifies the exact raw payload before parsing', () => {
    const raw = Buffer.from('{"entry":[]}');
    const signature =
      'sha256=' + createHmac('sha256', 'meta-app-secret').update(raw).digest('hex');
    expect(verifySignature(signature, raw)).toBe(true);
    expect(verifySignature(signature, Buffer.from('{"entry":[1]}'))).toBe(false);
  });

  it('normalizes message events without retaining the full webhook shape', () => {
    const events = parseEvents({
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    id: 'wamid.1',
                    from: '15551234',
                    type: 'text',
                    text: { body: 'help' }
                  }
                ]
              }
            }
          ]
        }
      ]
    });
    expect(events).toEqual([
      { id: 'wamid.1', from: '15551234', kind: 'text', text: 'help' }
    ]);
  });

  it('parses root-level Meta webhook values used by test adapters', () => {
    expect(
      parseIncomingWhatsAppEvents({
        value: {
          messages: [
            {
              id: 'wamid.2',
              from: '15550000',
              type: 'interactive',
              interactive: { button_reply: { id: 'confirm.token' } }
            }
          ]
        }
      })
    ).toEqual([
      {
        from: '15550000',
        messageId: 'wamid.2',
        type: 'button',
        buttonReplyId: 'confirm.token'
      }
    ]);
  });

  it('round-trips signed compressed action tokens', () => {
    const token = createSignedCompressedToken(['1', 'payload'], {
      secret: 'meta-app-secret'
    });
    expect(readSignedCompressedToken(token, { secret: 'meta-app-secret' })).toEqual([
      '1',
      'payload'
    ]);
    expect(readSignedCompressedToken(token, { secret: 'wrong-secret' })).toBeNull();
    expect(buildActionButtonId('confirm', token)).toBe('confirm.' + token);
    expect(parseActionButtonId('edit.' + token, ['confirm', 'edit'])).toEqual({
      action: 'edit',
      token
    });
    expect(actionButtonIdFits('confirm', token, 256)).toBe(true);
  });

  it('claims duplicate event IDs once in mock mode', async () => {
    const store = new MockIdempotencyStore();
    expect(await store.begin('wamid.1', 60)).toBe(true);
    expect(await store.begin('wamid.1', 60)).toBe(false);
  });
});
