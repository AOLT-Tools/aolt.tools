import { z } from 'zod';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createOfficialSearchService } from '../lib/factory.js';
import {
  parseSearchMode,
  parseDatePreset,
  parseSearchSource,
  parseRadiusKm,
  parseIsoDate,
  parseOnlineProgramId,
  readLocation
} from '../lib/searchRequest.js';
import { ONLINE_PROGRAM_IDS, type OnlineProgramId } from '../lib/onlinePrograms.js';

const SearchBodySchema = z.object({
  source: z.enum(['aol', 'center', 'vvmvp', 'vds']),
  mode: z.enum(['in_person', 'online']).optional(),
  courseCode: z
    .enum(ONLINE_PROGRAM_IDS as unknown as [OnlineProgramId, ...OnlineProgramId[]])
    .optional(),
  datePreset: z
    .enum(['anytime', 'today', 'tomorrow', 'this_weekend', 'next_7_days', 'custom'])
    .optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  radiusKm: z.number().positive().max(250).optional(),
  location: z
    .object({
      label: z.string().trim().min(1).max(256),
      latitude: z.number(),
      longitude: z.number(),
      city: z.string().trim().max(80).optional()
    })
    .optional()
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({
        success: false,
        error: { message: 'Method not allowed. Use POST.' }
      });
    }

    const body = SearchBodySchema.parse(readBody(req));
    const source = parseSearchSource(body.source);
    if (!source) {
      return res.status(400).json({
        success: false,
        error: { message: 'Source is required.' }
      });
    }
    const result = await createOfficialSearchService().search({
      source,
      mode: parseSearchMode(body.mode),
      courseCode: parseOnlineProgramId(body.courseCode),
      datePreset: parseDatePreset(body.datePreset),
      dateFrom: parseIsoDate(body.dateFrom),
      dateTo: parseIsoDate(body.dateTo),
      radiusKm: parseRadiusKm(body.radiusKm),
      location: readLocation(body.location)
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid search request.' }
      });
    }
    const message = error instanceof Error ? error.message : 'Search failed.';
    const status = message.toLowerCase().includes('parse') ? 400 : 500;
    return res.status(status).json({
      success: false,
      error: { message }
    });
  }
}

function readBody(req: VercelRequest): unknown {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}
