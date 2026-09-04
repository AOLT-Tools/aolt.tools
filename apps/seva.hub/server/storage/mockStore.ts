import {
  AssignMembersRequestSchema,
  AssignMembersResponseSchema,
  BootstrapResponseSchema,
  CreateCourseRequestSchema,
  CreateCourseResponseSchema,
  CreateLeadRequestSchema,
  CreateLeadResponseSchema,
  DeleteCourseRequestSchema,
  DeleteCourseResponseSchema,
  DeleteLeadRequestSchema,
  DeleteLeadResponseSchema,
  ListCoursesResponseSchema,
  PublicHomepageOffersResponseSchema,
  UpdateCourseRequestSchema,
  UpdateCourseResponseSchema,
  UpdateLeadRequestSchema,
  UpdateLeadResponseSchema,
  MAX_MEMBERS_PER_VOLUNTEER,
  type AssignMembersRequest,
  type AuthenticatedUser,
  type Course,
  type CreateLeadRequest,
  type DeleteCourseRequest,
  type DeleteLeadRequest,
  type Lead,
  type UpdateCourseRequest,
  type UpdateLeadRequest
} from '../../shared/contracts/appContracts.js';
import { matchesMemberEngagement } from '../../shared/memberAssignment.js';
import { nanoid } from 'nanoid';
import { ZodError } from 'zod';
import {
  DEFAULT_CENTER_WHATSAPP_NUMBER,
  homepageProgramOffers,
  selectActivePublicCourses
} from '../../shared/contracts/courseDefaults.mjs';
import { defaultCourseTemplates } from '../../shared/contracts/courseTemplates.mjs';
import { mockBootstrapData } from '../../src/repositories/mock/mockData.js';
import { mockCourses } from '../../src/repositories/mock/mockCourses.js';
import {
  applyCourseDefaults,
  hasDuplicateCourseSlot,
  toCourseResponse,
  type CourseRecord
} from '../courses/sheetMapping.js';
import { createMemoryImageStore, decodeImageBase64 } from '../courses/images.js';
import { normalizeEmail } from '@aolt/core/normalization';

type StoreState = {
  leads: Lead[];
  courses: CourseRecord[];
};

const mockShortUrls = [
  {
    slug: 'sample',
    destinationUrl: 'https://www.artofliving.org/in-en',
    isActive: true
  }
] as const;

const imageStore = createMemoryImageStore();

function toRecord(course: Course): CourseRecord {
  return {
    ...course,
    imageFileId: '',
    imageMimeType: ''
  };
}

const globalStore = globalThis as unknown as { __sevaHubStore?: StoreState };

function getStore(): StoreState {
  if (!globalStore.__sevaHubStore) {
    globalStore.__sevaHubStore = {
      leads: structuredClone(mockBootstrapData.leads),
      courses: structuredClone(mockCourses).map(toRecord)
    };
  }
  if (!globalStore.__sevaHubStore.courses) {
    globalStore.__sevaHubStore.courses = structuredClone(mockCourses).map(toRecord);
  }
  return globalStore.__sevaHubStore;
}

function isAssignedToUser(lead: Lead, email: string): boolean {
  return (
    normalizeEmail(String(lead.assignedVolunteerEmail || '')) === normalizeEmail(email)
  );
}

export function isUserAllowed(email: string) {
  const allowedUsers = mockBootstrapData.config.allowedUsers || [];
  if (!allowedUsers.length) {
    return true;
  }

  const requestedEmail = normalizeEmail(email);
  return allowedUsers
    .map((item: string) => normalizeEmail(item))
    .includes(requestedEmail);
}

export async function getBootstrapForUser(
  user: AuthenticatedUser,
  campaignId?: string | null
) {
  const store = getStore();
  const selectedCampaignId = campaignId || mockBootstrapData.campaignId;
  const selectedCampaign = mockBootstrapData.config.campaigns.find(
    (campaign: { id: string }) => campaign.id === selectedCampaignId
  );
  if (!selectedCampaign) {
    throw new Error('CAMPAIGN_NOT_FOUND');
  }

  const payload = {
    ...mockBootstrapData,
    user,
    campaignId: selectedCampaign.id,
    leads: store.leads.filter(
      (lead) =>
        isAssignedToUser(lead, String(user.email || '')) &&
        lead.campaignId === selectedCampaign.id &&
        lead.campaignType === selectedCampaign.type
    )
  };

  return BootstrapResponseSchema.parse(payload);
}

export async function updateLeadForUser(
  user: AuthenticatedUser,
  payload: UpdateLeadRequest
) {
  const store = getStore();
  const parsed = UpdateLeadRequestSchema.parse(payload);
  const targetVolunteerEmail = parsed.assignedVolunteerEmail
    ? normalizeEmail(parsed.assignedVolunteerEmail)
    : undefined;
  if (targetVolunteerEmail && !isUserAllowed(targetVolunteerEmail)) {
    throw new Error('VOLUNTEER_NOT_ALLOWED');
  }
  const index = store.leads.findIndex(
    (lead) => lead.id === parsed.id && lead.campaignType === parsed.campaignType
  );

  if (index < 0) {
    throw new Error('Lead not found.');
  }

  if (!isAssignedToUser(store.leads[index], String(user.email || ''))) {
    throw new Error('FORBIDDEN_LEAD_ASSIGNMENT');
  }

  store.leads[index] = {
    ...store.leads[index],
    ...parsed,
    assignedVolunteerEmail:
      targetVolunteerEmail || store.leads[index].assignedVolunteerEmail,
    lastUpdated: 'Just now'
  };

  return UpdateLeadResponseSchema.parse({
    success: true,
    lead: {
      id: parsed.id,
      lastUpdated: 'Just now'
    }
  });
}

export async function assignMembersToUser(
  user: AuthenticatedUser,
  payload: AssignMembersRequest
) {
  const parsed = AssignMembersRequestSchema.parse(payload);
  const campaign = mockBootstrapData.config.campaigns.find(
    (item) => item.id === parsed.campaignId
  );
  if (!campaign) {
    throw new Error('CAMPAIGN_NOT_FOUND');
  }
  if (campaign.type !== 'Members') {
    throw new Error('CAMPAIGN_TYPE_MISMATCH');
  }

  const store = getStore();
  const volunteerEmail = normalizeEmail(user.email);
  const currentCount = store.leads.filter(
    (lead) =>
      lead.campaignId === campaign.id &&
      lead.campaignType === 'Members' &&
      isAssignedToUser(lead, volunteerEmail)
  ).length;
  const availableCapacity = Math.max(0, MAX_MEMBERS_PER_VOLUNTEER - currentCount);
  const selected = store.leads
    .filter(
      (lead) =>
        lead.campaignId === campaign.id &&
        lead.campaignType === 'Members' &&
        !normalizeEmail(lead.assignedVolunteerEmail) &&
        matchesMemberEngagement(lead.quality, parsed.engagementLevels)
    )
    .slice(0, Math.min(parsed.count, availableCapacity));

  selected.forEach((lead) => {
    lead.assignedVolunteerEmail = volunteerEmail;
    lead.lastUpdated = 'Just now';
  });

  return AssignMembersResponseSchema.parse({
    success: true,
    requestedCount: parsed.count,
    assignedCount: selected.length,
    remainingCapacity: availableCapacity - selected.length,
    members: selected.map((lead) => ({ ...lead }))
  });
}

export async function createLeadForUser(
  user: AuthenticatedUser,
  payload: CreateLeadRequest
) {
  const store = getStore();
  const parsed = CreateLeadRequestSchema.parse(payload);
  const campaign = mockBootstrapData.config.campaigns.find(
    (item) => item.id === parsed.campaignId
  );
  if (!campaign) {
    throw new Error('CAMPAIGN_NOT_FOUND');
  }
  if (campaign.type !== parsed.campaignType) {
    throw new Error('CAMPAIGN_TYPE_MISMATCH');
  }

  const lead: Lead = {
    id: nanoid(),
    mobile: parsed.mobile,
    name: parsed.name,
    quality: parsed.campaignType === 'Members' ? 'Engagement' : 'Quality',
    followUp: 'Follow-up',
    lastUpdated: new Date().toISOString(),
    status: 'Response',
    notes: parsed.notes || '',
    campaignId: parsed.campaignId,
    campaignType: parsed.campaignType,
    assignedVolunteerEmail: normalizeEmail(user.email),
    wishlistPrograms: '',
    donePrograms: ''
  };
  store.leads.push(lead);
  return CreateLeadResponseSchema.parse({ success: true, lead });
}

export async function deleteLeadForUser(
  user: AuthenticatedUser,
  payload: DeleteLeadRequest
) {
  const store = getStore();
  const parsed = DeleteLeadRequestSchema.parse(payload);
  const index = store.leads.findIndex(
    (lead) => lead.id === parsed.id && lead.campaignType === parsed.campaignType
  );
  if (index < 0) {
    throw new Error('Lead not found.');
  }
  if (!isAssignedToUser(store.leads[index], String(user.email || ''))) {
    throw new Error('FORBIDDEN_LEAD_ASSIGNMENT');
  }
  store.leads.splice(index, 1);
  return DeleteLeadResponseSchema.parse({
    success: true,
    lead: { id: parsed.id }
  });
}

export async function listCoursesForUser() {
  return ListCoursesResponseSchema.parse({
    success: true,
    courses: getStore().courses.map((course) => toCourseResponse(course)),
    templates: defaultCourseTemplates()
  });
}

export async function createCourseForUser(user: AuthenticatedUser, payload: unknown) {
  const parsed = CreateCourseRequestSchema.parse(payload);
  if (hasDuplicateCourseSlot(getStore().courses, parsed)) {
    throw new ZodError([
      {
        code: 'custom',
        message: 'A course for this type and program already exists.',
        path: ['courseType']
      }
    ]);
  }
  const timestamp = new Date().toISOString();
  const id = nanoid();
  let imageFileId = '';
  let imageMimeType = '';
  if (parsed.imageBase64.trim()) {
    imageFileId = await imageStore.upload(
      id,
      decodeImageBase64(parsed.imageBase64, parsed.imageMimeType)
    );
    imageMimeType = parsed.imageMimeType;
  }
  const course = applyCourseDefaults(parsed, timestamp, normalizeEmail(user.email), {
    id,
    imageFileId,
    imageMimeType
  });
  getStore().courses.push(course);
  return CreateCourseResponseSchema.parse({
    success: true,
    course: toCourseResponse(course)
  });
}

export async function updateCourseForUser(
  user: AuthenticatedUser,
  payload: UpdateCourseRequest
) {
  const parsed = UpdateCourseRequestSchema.parse(payload);
  const store = getStore();
  const index = store.courses.findIndex((course) => course.id === parsed.id);
  if (index < 0) {
    throw new Error('Course not found.');
  }
  if (hasDuplicateCourseSlot(store.courses, parsed)) {
    throw new ZodError([
      {
        code: 'custom',
        message: 'A course for this type and program already exists.',
        path: ['courseType']
      }
    ]);
  }
  const existing = store.courses[index];
  let imageFileId = existing.imageFileId;
  let imageMimeType = existing.imageMimeType;
  if (parsed.clearImage && imageFileId) {
    await imageStore.remove(imageFileId);
    imageFileId = '';
    imageMimeType = '';
  }
  if (parsed.imageBase64.trim()) {
    const nextId = await imageStore.upload(
      parsed.id,
      decodeImageBase64(parsed.imageBase64, parsed.imageMimeType)
    );
    if (imageFileId && imageFileId !== nextId) {
      await imageStore.remove(imageFileId);
    }
    imageFileId = nextId;
    imageMimeType = parsed.imageMimeType;
  }
  const timestamp = new Date().toISOString();
  const course = applyCourseDefaults(parsed, timestamp, normalizeEmail(user.email), {
    id: parsed.id,
    existing,
    imageFileId,
    imageMimeType
  });
  store.courses[index] = course;
  return UpdateCourseResponseSchema.parse({
    success: true,
    course: toCourseResponse(course)
  });
}

export async function deleteCourseForUser(payload: DeleteCourseRequest) {
  const parsed = DeleteCourseRequestSchema.parse(payload);
  const store = getStore();
  const index = store.courses.findIndex((course) => course.id === parsed.id);
  if (index < 0) {
    throw new Error('Course not found.');
  }
  const existing = store.courses[index];
  await imageStore.removeCourse(existing.id, existing.imageFileId);
  store.courses.splice(index, 1);
  return DeleteCourseResponseSchema.parse({
    success: true,
    course: { id: parsed.id }
  });
}

export async function getPublicCourses(programKey = '') {
  const page = selectActivePublicCourses(getStore().courses, programKey);
  return {
    selected: page.selected ? toCourseResponse(page.selected) : null,
    courses: page.courses.map((course) => toCourseResponse(course)),
    selectionMatched: page.selectionMatched
  };
}

function normalizeShortUrlSlug(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/{2,}/g, '/')
    .toLowerCase();
}

export async function getShortUrlDestination(slug: string) {
  const normalized = normalizeShortUrlSlug(slug);
  const match = mockShortUrls.find(
    (item) => item.isActive && normalizeShortUrlSlug(item.slug) === normalized
  );
  return match?.destinationUrl || null;
}

export async function listPublicHomepageOffers() {
  return PublicHomepageOffersResponseSchema.parse({
    success: true,
    offers: homepageProgramOffers(getStore().courses),
    whatsappNumber:
      mockBootstrapData.config.centerWhatsappNumber || DEFAULT_CENTER_WHATSAPP_NUMBER
  });
}
