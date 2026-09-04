import { getWhatsAppSignatureEnv } from '../env.js';
import {
  normalizeEmail,
  normalizeIndianMobile,
  normalizeSpaces
} from '@aolt/core/normalization';
import {
  actionButtonIdFits,
  buildActionButtonId,
  createSignedCompressedToken,
  parseActionButtonId,
  readSignedCompressedToken
} from '@aolt/integrations/whatsapp/action-tokens';
import type { PendingLeadConfirmation } from './pendingStore.js';

const CONFIRM_ACTION = 'confirm_save';
const EDIT_ACTION = 'edit_lead';
const MAX_BUTTON_ID_CHARS = 256;
const MAX_INFLATED_TOKEN_BYTES = 8_192;
const SIGNATURE_BYTES = 12;
const TOKEN_VERSION = '1';

type ConfirmationAction = typeof CONFIRM_ACTION | typeof EDIT_ACTION;
type TokenPayload = [
  version: string,
  expiresAtBase36: string,
  volunteerEmail: string,
  volunteerPhone: string,
  mobile: string,
  name: string,
  course: string,
  leadQuality: string,
  month: string,
  notes: string
];

export function createConfirmationToken(
  pending: PendingLeadConfirmation
): string | null {
  const payload: TokenPayload = [
    TOKEN_VERSION,
    pending.expiresAt.toString(36),
    pending.volunteerEmail,
    pending.volunteerPhone,
    pending.parsed.mobile,
    pending.parsed.name,
    pending.parsed.course,
    pending.parsed.leadQuality,
    pending.parsed.month,
    pending.parsed.notes
  ];
  const token = createSignedCompressedToken(payload, {
    secret: getWhatsAppSignatureEnv().META_APP_SECRET,
    signatureBytes: SIGNATURE_BYTES
  });

  return actionButtonIdFits(CONFIRM_ACTION, token, MAX_BUTTON_ID_CHARS) ? token : null;
}

export function buildConfirmationButtonId(
  action: ConfirmationAction,
  token = ''
): string {
  return buildActionButtonId(action, token);
}

export function parseConfirmationButtonId(buttonIdValue: string): {
  action: ConfirmationAction;
  token: string;
} | null {
  return parseActionButtonId(buttonIdValue, [CONFIRM_ACTION, EDIT_ACTION]);
}

export function readConfirmationToken(
  token: string,
  volunteerPhone: string
): PendingLeadConfirmation | null {
  const suppliedSignature = String(token || '').split('.')[1] || '';
  const payload = readSignedCompressedToken(token, {
    secret: getWhatsAppSignatureEnv().META_APP_SECRET,
    signatureBytes: SIGNATURE_BYTES,
    maxInflatedBytes: MAX_INFLATED_TOKEN_BYTES
  });

  if (
    !payload ||
    payload.length !== 10 ||
    payload.some((value) => typeof value !== 'string')
  ) {
    return null;
  }

  const [
    version,
    expiresAtBase36,
    volunteerEmailRaw,
    volunteerPhoneRaw,
    mobileRaw,
    nameRaw,
    courseRaw,
    leadQualityRaw,
    monthRaw,
    notesRaw
  ] = payload as TokenPayload;
  const expiresAt = Number.parseInt(expiresAtBase36, 36);
  const canonicalPhone = normalizeIndianMobile(volunteerPhone);
  const tokenPhone = normalizeIndianMobile(volunteerPhoneRaw);
  const volunteerEmail = normalizeEmail(volunteerEmailRaw);
  const mobile = normalizeIndianMobile(mobileRaw);
  const name = normalizeSpaces(nameRaw);
  if (
    version !== TOKEN_VERSION ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= Date.now() ||
    !canonicalPhone ||
    tokenPhone !== canonicalPhone ||
    !volunteerEmail ||
    !mobile ||
    !name
  ) {
    return null;
  }

  const originalMessage = [
    name,
    mobile,
    normalizeSpaces(courseRaw),
    normalizeSpaces(leadQualityRaw),
    normalizeSpaces(monthRaw),
    normalizeSpaces(notesRaw)
  ]
    .filter(Boolean)
    .join(' ');
  const parsed = {
    mobile,
    name,
    course: normalizeSpaces(courseRaw),
    leadQuality: normalizeSpaces(leadQualityRaw),
    month: normalizeSpaces(monthRaw),
    notes: normalizeSpaces(notesRaw),
    originalMessage
  };

  return {
    id: `token:${suppliedSignature}`,
    sourceMessageId: '',
    volunteerPhone: canonicalPhone,
    volunteerEmail,
    originalMessage,
    parsed,
    createdAt: Math.max(0, expiresAt - 300_000),
    expiresAt
  };
}
