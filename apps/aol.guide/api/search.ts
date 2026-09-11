import { z } from 'zod';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createOfficialSearchService } from '../lib/factory.js';
import { parseSearchMode, parseDatePreset } from '../lib/searchRequest.js';

const SearchBodySchema = z.object({
  query: z.string().trim().min(1),
  mode: z.enum(['in_person', 'online']).optional(),
  datePreset: z
    .enum(['anytime', 'today', 'tomorrow', 'this_weekend', 'next_7_days'])
    .optional(),
  location: z
    .object({
      label: z.string().trim().min(1).max(256),
      latitude: z.number(),
      longitude: z.number(),
      pincode: z.string().trim().max(12).optional(),
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
    const result = await createOfficialSearchService().search({
      query: body.query,
      mode: parseSearchMode(body.mode),
      datePreset: parseDatePreset(body.datePreset),
      location: body.location
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
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
