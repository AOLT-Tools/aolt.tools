import { z } from 'zod';

import { todayInIndia } from '@aolt/core/dates';
import { generateGeminiJson } from '@aolt/integrations/gemini/json';

import { COURSE_ALIASES, VDS_EVENT_ALIASES } from './courseAliases.js';
import { normalizeExternalIntent } from './queryParser.js';
import type { ResolvedSearchIntent } from './searchIntent.js';

export type GeminiIntentParserOptions = {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  now?: Date;
};

const GeminiIntentSchema = z.object({
  source: z.enum(['aol', 'vvmvp', 'vds', 'all']).optional(),
  courseCode: z.string().trim().max(32).optional(),
  pincode: z.string().trim().max(12).optional(),
  city: z.string().trim().max(120).optional(),
  language: z.string().trim().max(40).optional(),
  radiusKm: z.number().min(1).max(250).optional(),
  deliveryMode: z.enum(['online', 'in_person', 'offline', 'any']).optional(),
  datePreset: z
    .enum([
      'today',
      'tomorrow',
      'this_week',
      'this_weekend',
      'next_week',
      'next_weekend'
    ])
    .optional(),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  startTimeFrom: z.string().trim().max(16).optional(),
  startTimeTo: z.string().trim().max(16).optional(),
  teacher: z.string().trim().max(120).optional(),
  keywords: z.array(z.string().trim().max(80)).max(8).optional(),
  eventType: z.string().trim().max(40).optional()
});

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    source: { type: 'string', enum: ['aol', 'vvmvp', 'vds', 'all'] },
    courseCode: { type: 'string' },
    pincode: { type: 'string' },
    city: { type: 'string' },
    language: { type: 'string' },
    radiusKm: { type: 'number', minimum: 1, maximum: 250 },
    deliveryMode: {
      type: 'string',
      enum: ['online', 'in_person', 'offline', 'any']
    },
    datePreset: {
      type: 'string',
      enum: [
        'today',
        'tomorrow',
        'this_week',
        'this_weekend',
        'next_week',
        'next_weekend'
      ]
    },
    dateFrom: { type: 'string' },
    dateTo: { type: 'string' },
    startTimeFrom: { type: 'string' },
    startTimeTo: { type: 'string' },
    teacher: { type: 'string' },
    keywords: { type: 'array', maxItems: 8, items: { type: 'string' } },
    eventType: { type: 'string' }
  }
} as const;

export class GeminiIntentParser {
  constructor(private readonly options: GeminiIntentParserOptions) {}

  async parse(query: string): Promise<ResolvedSearchIntent | null> {
    const parsedJson = await generateGeminiJson({
      apiKey: this.options.apiKey,
      model: this.options.model,
      fetchImpl: this.options.fetchImpl,
      timeoutMs: this.options.timeoutMs,
      systemInstruction: buildSystemPrompt(this.options.now),
      prompt: query,
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0
    });
    if (!parsedJson) return null;

    const parsed = GeminiIntentSchema.safeParse(parsedJson);
    if (!parsed.success) return null;
    const deliveryMode =
      parsed.data.deliveryMode === 'offline' ? 'in_person' : parsed.data.deliveryMode;
    return normalizeExternalIntent(
      query,
      { ...parsed.data, deliveryMode },
      { now: this.options.now }
    );
  }
}

function buildSystemPrompt(now?: Date): string {
  const catalog = COURSE_ALIASES.map((alias) => {
    return `${alias.code} = ${alias.label}; phrases: ${alias.keywords.join(', ')}`;
  }).join('\n');
  const eventCatalog = VDS_EVENT_ALIASES.map((alias) => {
    return `${alias.eventType} = ${alias.label}; phrases: ${alias.keywords.join(', ')}`;
  }).join('\n');

  return [
    'You convert one natural-language search into AOL Guide SearchIntent JSON.',
    'Your ONLY job is intent parsing. Never search programs, invent course type IDs, or use official site listings.',
    '',
    'RULES:',
    '- source=aol for Art of Living courses such as HP, Happiness Program, Intuition, Sahaj, AMP, yoga.',
    '- source=vvmvp for Bangalore Ashram / VVMVP programs.',
    '- source=vds for puja, homa, seva, Vaidic / Rudra Puja requests.',
    '- source=all only when the user clearly wants more than one family.',
    '- courseCode MUST be one of the catalog codes, or omit it.',
    '- Preserve a 6-digit Indian PIN exactly in pincode.',
    '- Put an explicit place name in city. Do not invent a city from a PIN.',
    '- Set radiusKm ONLY when the user wrote a distance such as 5km, 10 km, within 10km, under 15 kilometers.',
    '- Hindi/English/etc. goes in language using the English language name.',
    '- online/zoom/from home => deliveryMode=online. in person/offline/physical => deliveryMode=in_person.',
    '- this/next weekend and relative dates must use datePreset. Do NOT calculate calendar dates.',
    '- Explicit month names may use dateFrom/dateTo as YYYY-MM-DD. Today in India is ' +
      todayInIndia(now) +
      '.',
    '- by/with/teacher <name> goes in teacher. Do not invent a teacher name.',
    '- Never infer constraints the user did not request.',
    '',
    'COURSE CATALOG:',
    catalog,
    '',
    'EVENT CATALOG:',
    eventCatalog
  ].join('\n');
}
