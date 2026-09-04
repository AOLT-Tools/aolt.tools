import { z } from 'zod';
import { DEFAULT_SHEET_LAYOUT } from '../../shared/contracts/sheetContract.mjs';
import { getServerEnv } from '../env.js';

const SheetLayoutSchema = z.object({
  campaignsRange: z.string().min(1).default(DEFAULT_SHEET_LAYOUT.campaignsRange),
  leadsRange: z.string().min(1).default(DEFAULT_SHEET_LAYOUT.leadsRange),
  membersRange: z.string().min(1).default(DEFAULT_SHEET_LAYOUT.membersRange),
  coursesRange: z.string().min(1).default(DEFAULT_SHEET_LAYOUT.coursesRange),
  courseTemplatesRange: z
    .string()
    .min(1)
    .default(DEFAULT_SHEET_LAYOUT.courseTemplatesRange),
  shortUrlsRange: z.string().min(1).default(DEFAULT_SHEET_LAYOUT.shortUrlsRange),
  configRange: z.string().min(1).default(DEFAULT_SHEET_LAYOUT.configRange),
  allowedUsersRange: z.string().min(1).default(DEFAULT_SHEET_LAYOUT.allowedUsersRange)
});

export type SheetLayout = z.infer<typeof SheetLayoutSchema>;

let parsedLayout: SheetLayout | null = null;

export function getSheetLayout(): SheetLayout {
  if (parsedLayout) {
    return parsedLayout;
  }

  const rawLayout = getServerEnv().GOOGLE_SHEETS_LAYOUT_JSON;
  if (!rawLayout) {
    parsedLayout = SheetLayoutSchema.parse(DEFAULT_SHEET_LAYOUT);
    return parsedLayout;
  }

  let maybeJson: unknown;
  try {
    maybeJson = JSON.parse(rawLayout);
  } catch {
    throw new Error('GOOGLE_SHEETS_LAYOUT_JSON must be valid JSON when provided.');
  }

  parsedLayout = SheetLayoutSchema.parse({
    ...DEFAULT_SHEET_LAYOUT,
    ...(typeof maybeJson === 'object' && maybeJson ? maybeJson : {})
  });

  return parsedLayout;
}
