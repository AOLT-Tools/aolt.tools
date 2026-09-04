import { randomUUID } from 'node:crypto';
import { getWhatsAppPendingEnv } from '../env.js';
import { normalizeIndianMobile } from '@aolt/core/normalization';
import type { ParsedLeadMessage } from './leadParser.js';

export type PendingLeadConfirmation = {
  id: string;
  sourceMessageId: string;
  volunteerPhone: string;
  volunteerEmail: string;
  originalMessage: string;
  parsed: ParsedLeadMessage;
  createdAt: number;
  expiresAt: number;
};

type MemoryState = {
  pending: Map<string, PendingLeadConfirmation>;
  pendingTimeouts: Map<string, ReturnType<typeof setTimeout>>;
  processedMessageIds: Map<string, number>;
};

// Deliberately process-local: pending interactions and message coordination are
// ephemeral and are never written to Google Sheets. This is best-effort across
// warm requests; separate serverless instances cannot share or coordinate it.
const globalState = globalThis as unknown as {
  __sevaHubWhatsappState?: MemoryState;
};

function getMemoryState(): MemoryState {
  if (!globalState.__sevaHubWhatsappState) {
    globalState.__sevaHubWhatsappState = {
      pending: new Map(),
      pendingTimeouts: new Map(),
      processedMessageIds: new Map()
    };
  }
  return globalState.__sevaHubWhatsappState;
}

function nowMs(): number {
  return Date.now();
}

function ttlMs(): number {
  return getWhatsAppPendingEnv().WHATSAPP_PENDING_TTL_SECONDS * 1000;
}

function pendingKey(volunteerPhone: string): string {
  return normalizeIndianMobile(volunteerPhone) || String(volunteerPhone || '').trim();
}

function clearPendingTimeout(memory: MemoryState, pendingId: string): void {
  const timeout = memory.pendingTimeouts.get(pendingId);
  if (timeout === undefined) {
    return;
  }

  clearTimeout(timeout);
  memory.pendingTimeouts.delete(pendingId);
}

function cleanExpiredMessageIds(): void {
  const memory = getMemoryState();
  const currentTime = nowMs();
  for (const [messageId, expiresAt] of memory.processedMessageIds) {
    if (expiresAt <= currentTime) {
      memory.processedMessageIds.delete(messageId);
    }
  }
}

/** Guards against Meta re-delivering the same webhook message. */
export function wasMessageProcessed(messageId: string): boolean {
  const key = String(messageId || '').trim();
  if (!key) {
    return false;
  }

  cleanExpiredMessageIds();
  return getMemoryState().processedMessageIds.has(key);
}

export function markMessageProcessed(messageId: string): void {
  const key = String(messageId || '').trim();
  if (!key) {
    return;
  }

  getMemoryState().processedMessageIds.set(key, nowMs() + ttlMs());
}

export async function getPendingLead(
  volunteerPhone: string
): Promise<PendingLeadConfirmation | null> {
  const memory = getMemoryState();
  const phone = pendingKey(volunteerPhone);
  const pending = memory.pending.get(phone);
  if (!pending) {
    return null;
  }

  if (pending.expiresAt <= nowMs()) {
    clearPendingTimeout(memory, pending.id);
    memory.pending.delete(phone);
    return null;
  }

  return pending;
}

export async function upsertPendingLead(
  volunteerPhone: string,
  volunteerEmail: string,
  parsed: ParsedLeadMessage,
  sourceMessageId = ''
): Promise<PendingLeadConfirmation> {
  const memory = getMemoryState();
  const canonicalPhone = pendingKey(volunteerPhone);
  const previous = memory.pending.get(canonicalPhone);
  if (previous) {
    clearPendingTimeout(memory, previous.id);
  }

  const currentTime = nowMs();
  const pending: PendingLeadConfirmation = {
    id: sourceMessageId || randomUUID(),
    sourceMessageId,
    volunteerPhone: canonicalPhone,
    volunteerEmail,
    originalMessage: parsed.originalMessage,
    parsed,
    createdAt: currentTime,
    expiresAt: currentTime + ttlMs()
  };
  memory.pending.set(canonicalPhone, pending);
  return pending;
}

export function schedulePendingLeadTimeout(pending: PendingLeadConfirmation): void {
  const memory = getMemoryState();
  clearPendingTimeout(memory, pending.id);

  const timeout = setTimeout(
    () => {
      const currentMemory = getMemoryState();
      if (currentMemory.pendingTimeouts.get(pending.id) !== timeout) {
        return;
      }

      currentMemory.pendingTimeouts.delete(pending.id);
      const phone = pendingKey(pending.volunteerPhone);
      if (currentMemory.pending.get(phone)?.id !== pending.id) {
        return;
      }
      currentMemory.pending.delete(phone);
    },
    Math.max(0, pending.expiresAt - nowMs())
  );

  memory.pendingTimeouts.set(pending.id, timeout);
  (timeout as ReturnType<typeof setTimeout> & { unref?: () => void }).unref?.();
}

/** Removes a pending confirmation (if it still matches `expectedPendingId`) and cancels its timeout. */
export async function removePendingLead(
  volunteerPhone: string,
  expectedPendingId = ''
): Promise<boolean> {
  const memory = getMemoryState();
  const phone = pendingKey(volunteerPhone);
  const current = memory.pending.get(phone);
  if (!current || (expectedPendingId && current.id !== expectedPendingId)) {
    return false;
  }

  clearPendingTimeout(memory, current.id);
  memory.pending.delete(phone);
  return true;
}

export function __resetWhatsAppStateForTests(): void {
  const memory = globalState.__sevaHubWhatsappState;
  if (memory) {
    for (const timeout of memory.pendingTimeouts.values()) {
      clearTimeout(timeout);
    }
  }
  globalState.__sevaHubWhatsappState = undefined;
}
