import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { SHEET_HEADERS } from '../shared/contracts/sheetContract.mjs';
import {
  DEFAULT_EVENT_WHATSAPP_TEMPLATE,
  defaultCourseTemplateRows,
  DEFAULT_HP_WHATSAPP_TEMPLATE
} from '../shared/contracts/courseTemplates.mjs';
import { formatCourseTitle } from '../shared/contracts/courseDefaults.mjs';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(
  appRoot,
  'docs',
  'templates',
  'seva-hub-sheets-template.xlsx'
);
mkdirSync(dirname(outputPath), { recursive: true });

const workbook = XLSX.utils.book_new();

const leadHeaders = [...SHEET_HEADERS.leads];
const campaignHeaders = [...SHEET_HEADERS.campaigns];

const campaignsRows = [
  campaignHeaders,
  [
    'cmpLeads01AbcDefGhIJk',
    'July Leads Campaign',
    'Leads',
    'Hi {name}, greetings from Art of Living.',
    'true'
  ],
  [
    'cmpMembs01AbcDefGhIJK',
    'Member Reconnect Drive',
    'Members',
    'Hi {name}, warm greetings from {campaign}.',
    'true'
  ]
];

const leadsRows = [
  leadHeaders,
  [
    'leadSmpl01AbcDefGhIJK',
    'Sample Lead',
    'Hot',
    '2026-08-01T18:00',
    '2026-08-01T12:00:00.000Z',
    'Connected',
    'Sample notes',
    'cmpLeads01AbcDefGhIJk',
    'Leads',
    'volunteer@example.com',
    'HP,DSN',
    'Sahaj',
    '9876543210'
  ]
];

const membersRows = [
  leadHeaders,
  [
    'membSmpl01AbcDefGhIJK',
    'Sample Member',
    'Active',
    '2026-08-05T10:00',
    '2026-08-01T12:00:00.000Z',
    'Will Attend',
    'Member follow-up',
    'cmpMembs01AbcDefGhIJK',
    'Members',
    'volunteer@example.com',
    'YES+,VTP',
    'HP',
    '9123456780'
  ]
];

const configRows = [
  [...SHEET_HEADERS.config],
  ['id', 'cfgMain01AbcDefGhIJK9'],
  ['campaignId', 'cmpLeads01AbcDefGhIJk'],
  [
    'programs',
    '[{"code":"HP","label":"Happiness Program"},{"code":"VTP","label":"Volunteer Training Program"},{"code":"DSN","label":"Divya Samaj Nirman"},{"code":"IP","label":"Intuition Process"},{"code":"IP2","label":"Intuition Process 2"},{"code":"Sahaj","label":"Sahaj Samadhi Meditation"},{"code":"YES+","label":"YES Plus"}]'
  ],
  ['programDisplayOrder', '["HP","VTP","DSN","IP","IP2","Sahaj","YES+"]'],
  ['showDonePrograms', 'true'],
  ['defaultCampaignMessage', 'Hi {name}, greetings from Art of Living.'],
  ['whatsappCountryCode', '91'],
  ['centerWhatsappNumber', '918884560660']
];

const allowedUsersRows = [
  [...SHEET_HEADERS.allowedUsers],
  ['volunteer@example.com', 'Sample Volunteer', '919999999999'],
  ['admin@example.com', 'Sample Admin', '918888888888']
];

const coursesRows = [
  [...SHEET_HEADERS.courses],
  [
    'crsHpNcr01AbcDefGhiJK',
    'Course',
    'HP',
    '',
    formatCourseTitle('HP', ''),
    DEFAULT_HP_WHATSAPP_TEMPLATE,
    '',
    '',
    'true',
    '2026-08-01T12:00:00.000Z',
    '2026-08-01T12:00:00.000Z',
    'volunteer@example.com',
    'volunteer@example.com'
  ],
  [
    'evtSats01AbcDefGhiJKL',
    'Event',
    '',
    '',
    'Weekly Member Follow-up',
    DEFAULT_EVENT_WHATSAPP_TEMPLATE,
    '',
    '',
    'true',
    '2026-08-01T12:00:00.000Z',
    '2026-08-01T12:00:00.000Z',
    'volunteer@example.com',
    'volunteer@example.com'
  ]
];

const courseTemplatesRows = [
  [...SHEET_HEADERS.courseTemplates],
  ...defaultCourseTemplateRows()
];

const shortUrlsRows = [
  [...SHEET_HEADERS.shortUrls],
  ['sample', 'https://www.artofliving.org/in-en', 'true'],
  ['tu/rp', 'https://www.artofliving.org/in-en/programs', 'true']
];

XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(leadsRows), 'Leads');
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(membersRows), 'Members');
XLSX.utils.book_append_sheet(
  workbook,
  XLSX.utils.aoa_to_sheet(campaignsRows),
  'Campaigns'
);
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(configRows), 'Config');
XLSX.utils.book_append_sheet(
  workbook,
  XLSX.utils.aoa_to_sheet(coursesRows),
  'Activities'
);
XLSX.utils.book_append_sheet(
  workbook,
  XLSX.utils.aoa_to_sheet(courseTemplatesRows),
  'CourseTemplates'
);
XLSX.utils.book_append_sheet(
  workbook,
  XLSX.utils.aoa_to_sheet(shortUrlsRows),
  'ShortUrls'
);
XLSX.utils.book_append_sheet(
  workbook,
  XLSX.utils.aoa_to_sheet(allowedUsersRows),
  'AllowedUsers'
);

XLSX.writeFile(workbook, outputPath);
console.log('Template created at ' + outputPath);
