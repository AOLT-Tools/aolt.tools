import type { Campaign } from '../../shared/contracts/appContracts.js';
import {
  DEFAULT_PROGRAMS,
  getDefaultQualityOptionsForCampaignType
} from '../../src/config/campaignDefaults.js';
import { nanoid } from 'nanoid';
import {
  normalizeEmail,
  normalizeIndianMobile,
  normalizeSpaces
} from '@aolt/core/normalization';
import { getSheetLayout } from '../sheets/layout.js';
import {
  appendSheetRow,
  readSheetValues,
  updateSheetValuesBatch
} from '../sheets/client.js';
import {
  columnLabel,
  findHeaderIndex,
  getTabName,
  parseJsonValue,
  rowsToCampaigns,
  rowsToConfigMap,
  rowsToTable
} from '../sheets/table.js';
import {
  getPendingLead,
  removePendingLead,
  schedulePendingLeadTimeout,
  type PendingLeadConfirmation,
  upsertPendingLead
} from './pendingStore.js';
import {
  parseLeadMessage,
  type LeadParserCatalog,
  type ParsedLeadMessage,
  type ParserTerm
} from './leadParser.js';
import {
  createConfirmationToken,
  parseConfirmationButtonId,
  readConfirmationToken
} from './confirmationToken.js';

const DEFAULT_MONTH_TERMS = [
  ['Jan', ['January']],
  ['Feb', ['February']],
  ['Mar', ['March']],
  ['Apr', ['April']],
  ['May', []],
  ['Jun', ['June']],
  ['Jul', ['July']],
  ['Aug', ['August']],
  ['Sep', ['September']],
  ['Oct', ['October']],
  ['Nov', ['November']],
  ['Dec', ['December']]
] as const;

const DEFAULT_LEAD_QUALITY = 'Hot';
const DEFAULT_LEAD_PROGRAM = 'HP';

type VolunteerInfo = {
  email: string;
  mobile: string;
};

function expandMonthAliases(shortName: string, aliases: readonly string[]): string[] {
  const expanded = new Set<string>(aliases);
  for (const alias of aliases) {
    for (let length = shortName.length + 1; length < alias.length; length += 1) {
      expanded.add(alias.slice(0, length));
    }
  }
  return [...expanded];
}

function monthMatchesTerm(
  monthValue: string,
  shortName: string,
  aliases: readonly string[]
): boolean {
  const lowered = monthValue.toLowerCase();
  if (!lowered) {
    return false;
  }
  if (shortName.toLowerCase() === lowered) {
    return true;
  }
  return expandMonthAliases(shortName, aliases).some(
    (alias) => alias.toLowerCase() === lowered
  );
}

function aliasesForMonth(shortName: string): string[] {
  const configuredAliases =
    DEFAULT_MONTH_TERMS.find(([candidate]) => candidate === shortName)?.[1] || [];
  return [shortName, ...expandMonthAliases(shortName, configuredAliases)];
}

function toShortMonth(monthValue: string): string {
  if (!monthValue) {
    return '';
  }

  const match = DEFAULT_MONTH_TERMS.find(([shortName, aliases]) =>
    monthMatchesTerm(monthValue, shortName, aliases)
  );

  return match ? match[0] : '';
}

function getCurrentShortMonth(): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: 'Asia/Kolkata'
  }).format(new Date());
}

function buildTermsFromList(values: string[]): ParserTerm[] {
  return values
    .map((value) => normalizeSpaces(value))
    .filter(Boolean)
    .map((value) => ({
      canonical: value,
      aliases: []
    }));
}

async function loadParserCatalog(): Promise<LeadParserCatalog> {
  const layout = getSheetLayout();
  const configRows = await readSheetValues('data', layout.configRange);
  const configMap = rowsToConfigMap(configRows);
  const programs = parseJsonValue<Array<{ code?: string; label?: string }>>(
    configMap.programs,
    []
  );
  const configuredPrograms = programs.length ? programs : DEFAULT_PROGRAMS;
  const courseTerms: ParserTerm[] = configuredPrograms
    .map((program) => {
      const code = normalizeSpaces(program.code || '');
      const label = normalizeSpaces(program.label || '');
      if (!code && !label) {
        return null;
      }

      return {
        canonical: code || label,
        aliases: [label].filter(Boolean)
      } as ParserTerm;
    })
    .filter((item): item is ParserTerm => Boolean(item));

  const qualityTerms = buildTermsFromList(
    getDefaultQualityOptionsForCampaignType('Leads')
  );

  const customMonths = parseJsonValue<string[]>(configMap.months, []);
  const monthTerms: ParserTerm[] = customMonths.length
    ? buildTermsFromList(customMonths).map((term) => {
        const canonical = toShortMonth(term.canonical) || term.canonical;
        return {
          canonical,
          aliases: [...new Set([term.canonical, ...aliasesForMonth(canonical)])]
        };
      })
    : DEFAULT_MONTH_TERMS.map(([shortName, aliases]) => ({
        canonical: shortName,
        aliases: expandMonthAliases(shortName, aliases)
      }));

  return {
    courses: courseTerms,
    leadQualities: qualityTerms,
    months: monthTerms
  };
}

async function loadCampaigns(): Promise<Campaign[]> {
  const layout = getSheetLayout();
  return rowsToCampaigns(await readSheetValues('data', layout.campaignsRange));
}

async function findVolunteerByPhone(fromPhone: string): Promise<VolunteerInfo | null> {
  const normalizedFrom = normalizeIndianMobile(fromPhone);
  if (!normalizedFrom) {
    return null;
  }

  const layout = getSheetLayout();
  const rows = await readSheetValues('access', layout.allowedUsersRange);
  const { headers, records } = rowsToTable(rows);
  if (!headers.length) {
    return null;
  }

  const emailIndex = findHeaderIndex(headers, [
    'email',
    'volunteerEmail',
    'volunteer_email'
  ]);
  const mobileIndex = findHeaderIndex(headers, ['mobile', 'phone', 'volunteerMobile']);
  if (emailIndex < 0 || mobileIndex < 0) {
    return null;
  }

  const emailHeader = headers[emailIndex];
  const mobileHeader = headers[mobileIndex];

  for (const { record } of records) {
    const candidate = normalizeIndianMobile(record[mobileHeader] || '');
    if (!candidate || candidate !== normalizedFrom) {
      continue;
    }

    const email = normalizeEmail(record[emailHeader] || '');
    if (!email) {
      continue;
    }

    return {
      email,
      mobile: candidate
    };
  }

  return null;
}

type CampaignMonthResolution =
  | { status: 'matched'; campaign: Campaign }
  | { status: 'no_leads_campaigns' }
  | { status: 'no_month_match'; month: string }
  | { status: 'ambiguous_month'; month: string };

function campaignMonthErrorMessage(
  resolution: Exclude<CampaignMonthResolution, { status: 'matched' }>
): string {
  if (resolution.status === 'no_leads_campaigns') {
    return 'No leads campaign is configured. Please ask an admin to add a Leads campaign.';
  }
  if (resolution.status === 'no_month_match') {
    return (
      'No leads campaign matches ' +
      resolution.month +
      '. Please ask an admin to name a campaign with that month, or resend using a matching month.'
    );
  }
  return (
    'More than one leads campaign matches ' +
    resolution.month +
    ". Please ask an admin to make that month's campaign name unique."
  );
}

function campaignNameWords(name: string): Set<string> {
  return new Set(
    String(name || '')
      .toLowerCase()
      .match(/[a-z]+/g) || []
  );
}

export function resolveLeadCampaign(
  campaigns: Campaign[],
  monthShort: string
): CampaignMonthResolution {
  const leadsCampaigns = campaigns.filter((campaign) => campaign.type === 'Leads');
  if (!leadsCampaigns.length) {
    return { status: 'no_leads_campaigns' };
  }

  const shortMonth = toShortMonth(monthShort) || monthShort;
  if (!shortMonth) {
    return { status: 'no_month_match', month: monthShort };
  }
  const monthAliases = aliasesForMonth(shortMonth).map((alias) => alias.toLowerCase());

  const matches = leadsCampaigns.filter((campaign) => {
    const words = campaignNameWords(campaign.name);
    return monthAliases.some((alias) => words.has(alias));
  });

  if (matches.length === 1) {
    return { status: 'matched', campaign: matches[0] };
  }
  if (matches.length === 0) {
    return { status: 'no_month_match', month: shortMonth };
  }
  return { status: 'ambiguous_month', month: shortMonth };
}

function appendNotes(existing: string, extra: string): string {
  const current = normalizeSpaces(existing);
  const incoming = normalizeSpaces(extra);
  if (!incoming) {
    return current;
  }
  if (!current) {
    return incoming;
  }
  if (current.split(' | ').some((part) => normalizeSpaces(part) === incoming)) {
    return current;
  }
  return current + ' | ' + incoming;
}

type UpsertResult = {
  action: 'created' | 'updated';
};

export async function upsertLeadByMobileAndCampaign(
  volunteerEmail: string,
  parsed: ParsedLeadMessage,
  campaign: Campaign
): Promise<UpsertResult> {
  const layout = getSheetLayout();
  const tabName = getTabName(layout.leadsRange);
  const { headers, records } = rowsToTable(
    await readSheetValues('data', layout.leadsRange)
  );
  if (!headers.length) {
    throw new Error('Lead sheet is missing header row.');
  }

  const idIndex = findHeaderIndex(headers, ['id']);
  const mobileHeaderIndex = findHeaderIndex(headers, ['mobile', 'phone']);
  const campaignIdIndex = findHeaderIndex(headers, ['campaignId']);

  if (idIndex < 0) {
    throw new Error('Lead sheet must contain id column.');
  }
  if (mobileHeaderIndex < 0) {
    throw new Error('Lead sheet must contain mobile/phone column.');
  }
  if (campaignIdIndex < 0) {
    throw new Error('Lead sheet must contain campaignId column.');
  }

  const mobileHeader = headers[mobileHeaderIndex];
  const campaignIdHeader = headers[campaignIdIndex];
  const existingLead = records.find(
    ({ record }) =>
      normalizeIndianMobile(record[mobileHeader] || '') === parsed.mobile &&
      normalizeSpaces(record[campaignIdHeader] || '') === campaign.id
  );

  const now = new Date().toISOString();
  if (existingLead) {
    const { record: row, rowNumber: targetRowNumber } = existingLead;
    const merged: Record<string, string> = {
      name: parsed.name || row.name || '',
      quality: parsed.leadQuality || row.quality || 'Quality',
      notes: appendNotes(row.notes || '', parsed.notes),
      campaignId: campaign.id,
      campaignType: 'Leads',
      assignedVolunteerEmail: row.assignedVolunteerEmail || volunteerEmail,
      wishlistPrograms: parsed.course || row.wishlistPrograms || '',
      lastUpdated: now
    };
    merged[mobileHeader] = parsed.mobile;

    const updates = Object.entries(merged).flatMap(([header, value]) => {
      const headerIndex = headers.indexOf(header);
      if (headerIndex < 0 || row[header] === value) {
        return [];
      }
      const cell = `${tabName}!${columnLabel(headerIndex + 1)}${targetRowNumber}`;
      return [{ range: cell, values: [[value]] }];
    });
    await updateSheetValuesBatch('data', updates);
    return { action: 'updated' };
  }

  const rowRecord: Record<string, string> = {
    id: nanoid(),
    name: parsed.name,
    quality: parsed.leadQuality || 'Quality',
    followUp: 'Follow-up',
    lastUpdated: now,
    status: 'Response',
    notes: parsed.notes,
    campaignId: campaign.id,
    campaignType: 'Leads',
    assignedVolunteerEmail: volunteerEmail,
    wishlistPrograms: parsed.course,
    donePrograms: ''
  };
  rowRecord[mobileHeader] = parsed.mobile;

  await appendSheetRow(
    'data',
    `${tabName}!A:${columnLabel(headers.length)}`,
    headers.map((header) => rowRecord[header] ?? '')
  );
  return { action: 'created' };
}

async function savePendingLead(
  pending: PendingLeadConfirmation
): Promise<UpsertResult | { error: string }> {
  const campaigns = await loadCampaigns();
  const monthForCampaign = pending.parsed.month || getCurrentShortMonth();
  const resolved = resolveLeadCampaign(campaigns, monthForCampaign);
  if (resolved.status !== 'matched') {
    return { error: campaignMonthErrorMessage(resolved) };
  }

  return upsertLeadByMobileAndCampaign(
    pending.volunteerEmail,
    {
      ...pending.parsed,
      month: monthForCampaign
    },
    resolved.campaign
  );
}

function parseAndValidateLead(
  message: string,
  catalog: LeadParserCatalog
): ParsedLeadMessage {
  const parsed = parseLeadMessage(message, catalog);
  if (!parsed.mobile) {
    throw new Error('MISSING_MOBILE');
  }
  if (!parsed.name) {
    throw new Error('MISSING_NAME');
  }

  return parsed;
}

export function buildEditableLeadMessage(parsed: ParsedLeadMessage): string {
  return [
    parsed.name,
    parsed.mobile,
    parsed.course,
    parsed.leadQuality,
    parsed.month,
    parsed.notes
  ]
    .map((value) => normalizeSpaces(value))
    .filter(Boolean)
    .join(' ');
}

export function buildShareableLeadMessage(parsed: ParsedLeadMessage): string {
  return [
    'Lead added 👍',
    '',
    'Name: ' + parsed.name,
    'Mobile: ' + parsed.mobile,
    parsed.course ? 'Course: ' + parsed.course : '',
    parsed.leadQuality ? 'Quality: ' + parsed.leadQuality : '',
    parsed.month ? 'Month: ' + parsed.month : '',
    parsed.notes ? 'Notes: ' + parsed.notes : ''
  ]
    .filter((line, index) => index < 2 || Boolean(line))
    .join('\n');
}

export async function handleIncomingText(
  volunteerPhone: string,
  text: string,
  messageId = ''
): Promise<{
  action: 'ignore' | 'show_confirmation' | 'send_text';
  parsed?: ParsedLeadMessage;
  message?: string;
  confirmationToken?: string;
}> {
  const volunteer = await findVolunteerByPhone(volunteerPhone);
  if (!volunteer) {
    return {
      action: 'send_text',
      message:
        'Thank you for reaching out! 🙏 For more details about Art of Living programs and activities, please contact us at 88845 60660.'
    };
  }

  const pending = await getPendingLead(volunteerPhone);
  if (pending) {
    if (messageId && pending.sourceMessageId === messageId) {
      const confirmationToken = createConfirmationToken(pending);
      if (!confirmationToken) {
        await removePendingLead(volunteerPhone, pending.id);
        return {
          action: 'send_text',
          message:
            'The notes are too long to confirm in WhatsApp. Please resend with shorter notes.'
        };
      }
      return {
        action: 'show_confirmation',
        parsed: pending.parsed,
        confirmationToken
      };
    }
    return {
      action: 'send_text',
      message: 'Please choose Confirm & Save or Edit for the previous lead.'
    };
  }

  const catalog = await loadParserCatalog();
  let parsed: ParsedLeadMessage;
  try {
    parsed = parseAndValidateLead(text, catalog);
    parsed = {
      ...parsed,
      course: parsed.course || DEFAULT_LEAD_PROGRAM,
      leadQuality: parsed.leadQuality || DEFAULT_LEAD_QUALITY,
      month: parsed.month || getCurrentShortMonth()
    };
  } catch (error) {
    const messageCode = error instanceof Error ? error.message : 'INVALID_MESSAGE';

    if (messageCode === 'MISSING_MOBILE') {
      return {
        action: 'send_text',
        message: "I couldn't find a valid mobile number. Please resend with mobile."
      };
    }

    if (messageCode === 'MISSING_NAME') {
      return {
        action: 'send_text',
        message:
          "I couldn't find the name near mobile number. Please resend in format: <name> 9876543210 HP Hot Aug"
      };
    }

    return {
      action: 'send_text',
      message: 'Unable to parse this lead. Please resend in a simple format.'
    };
  }

  const createdPending = await upsertPendingLead(
    volunteerPhone,
    volunteer.email,
    parsed,
    messageId
  );
  const confirmationToken = createConfirmationToken(createdPending);
  if (!confirmationToken) {
    await removePendingLead(volunteerPhone, createdPending.id);
    return {
      action: 'send_text',
      message:
        'The notes are too long to confirm in WhatsApp. Please resend with shorter notes.'
    };
  }
  schedulePendingLeadTimeout(createdPending);

  return {
    action: 'show_confirmation',
    parsed,
    confirmationToken
  };
}

export async function handleButtonReply(
  volunteerPhone: string,
  buttonId: string
): Promise<{
  action: 'ignore' | 'send_text';
  message?: string;
  messages?: string[];
}> {
  const parsedButton = parseConfirmationButtonId(buttonId);
  const action = parsedButton?.action || buttonId;
  const pending =
    (await getPendingLead(volunteerPhone)) ||
    (parsedButton?.token
      ? readConfirmationToken(parsedButton.token, volunteerPhone)
      : null);
  if (!pending) {
    return {
      action: 'send_text',
      message: 'No pending lead confirmation found. Please send lead details again.'
    };
  }

  if (action === 'edit_lead') {
    await removePendingLead(volunteerPhone, pending.id);
    return {
      action: 'send_text',
      messages: [
        'Copy the next message, correct any details, and send it back.',
        buildEditableLeadMessage(pending.parsed) || pending.originalMessage
      ]
    };
  }

  if (action !== 'confirm_save') {
    return { action: 'ignore' };
  }

  const saved = await savePendingLead(pending);
  if ('error' in saved) {
    return {
      action: 'send_text',
      message: saved.error
    };
  }
  await removePendingLead(volunteerPhone, pending.id);

  if (saved.action === 'updated') {
    return {
      action: 'send_text',
      message: 'ℹ️ Lead already existed for this month. Existing lead has been updated.'
    };
  }

  return {
    action: 'send_text',
    message: buildShareableLeadMessage(pending.parsed)
  };
}
