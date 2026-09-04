export const DEFAULT_SHEET_LAYOUT = Object.freeze({
  campaignsRange: 'Campaigns!A:F',
  leadsRange: 'Leads!A:Z',
  membersRange: 'Members!A:Z',
  coursesRange: 'Activities!A:Z',
  courseTemplatesRange: 'CourseTemplates!A:B',
  shortUrlsRange: 'ShortUrls!A:C',
  configRange: 'Config!A:B',
  allowedUsersRange: 'AllowedUsers!A:Z'
});

const leadHeaders = Object.freeze([
  'id',
  'name',
  'quality',
  'followUp',
  'lastUpdated',
  'status',
  'notes',
  'campaignId',
  'campaignType',
  'assignedVolunteerEmail',
  'wishlistPrograms',
  'donePrograms',
  'mobile'
]);

export const SHEET_HEADERS = Object.freeze({
  campaigns: Object.freeze(['id', 'name', 'type', 'message', 'showDonePrograms']),
  leads: leadHeaders,
  members: leadHeaders,
  courses: Object.freeze([
    'id',
    'activityType',
    'courseType',
    'programCode',
    'title',
    'whatsappTemplate',
    'imageFileId',
    'imageMimeType',
    'isActive',
    'createdAt',
    'updatedAt',
    'createdBy',
    'updatedBy'
  ]),
  courseTemplates: Object.freeze(['courseType', 'template']),
  shortUrls: Object.freeze(['slug', 'destinationUrl', 'isActive']),
  config: Object.freeze(['key', 'value']),
  allowedUsers: Object.freeze(['email', 'name', 'mobile'])
});

export const REQUIRED_CONFIG_KEYS = Object.freeze([
  'id',
  'campaignId',
  'programs',
  'programDisplayOrder',
  'centerWhatsappNumber'
]);
