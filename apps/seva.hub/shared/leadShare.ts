export interface LeadShareDetails {
  name: string;
  mobile: string;
  course?: string;
  leadQuality?: string;
  month?: string;
  notes?: string;
}

export function buildLeadShareMessage(lead: LeadShareDetails): string {
  return [
    'Lead added 👍',
    '',
    'Name: ' + lead.name,
    'Mobile: ' + lead.mobile,
    lead.course ? 'Course: ' + lead.course : '',
    lead.leadQuality ? 'Quality: ' + lead.leadQuality : '',
    lead.month ? 'Month: ' + lead.month : '',
    lead.notes ? 'Notes: ' + lead.notes : ''
  ]
    .filter((line, index) => index < 2 || Boolean(line))
    .join('\n');
}
