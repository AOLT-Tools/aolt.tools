import type { Course } from '../../../shared/contracts/appContracts.js';
import { formatCourseTitle } from '../../../shared/contracts/courseDefaults.mjs';
import {
  DEFAULT_EVENT_WHATSAPP_TEMPLATE,
  DEFAULT_HP_WHATSAPP_TEMPLATE,
  DEFAULT_COURSE_WHATSAPP_TEMPLATE
} from '../../../shared/contracts/courseTemplates.mjs';

export const mockCourses: Course[] = [
  {
    id: 'crsHpNcr01AbcDefGhiJK',
    activityType: 'Course',
    targetAudience: 'Leads',
    courseType: 'HP',
    programCode: '',
    title: formatCourseTitle('HP', ''),
    whatsappTemplate: DEFAULT_HP_WHATSAPP_TEMPLATE,
    isActive: true,
    hasImage: false,
    imageUrl: '',
    createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-08-01T12:00:00.000Z',
    createdBy: 'volunteer@example.com',
    updatedBy: 'volunteer@example.com'
  },
  {
    id: 'crsDsnNc01AbcDefGhiJK',
    activityType: 'Course',
    targetAudience: 'Leads',
    courseType: 'DSN',
    programCode: '',
    title: formatCourseTitle('DSN', ''),
    whatsappTemplate: DEFAULT_COURSE_WHATSAPP_TEMPLATE,
    isActive: false,
    hasImage: false,
    imageUrl: '',
    createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-08-01T12:00:00.000Z',
    createdBy: 'volunteer@example.com',
    updatedBy: 'volunteer@example.com'
  },
  {
    id: 'crsIpJnr01AbcDefGhiJK',
    activityType: 'Course',
    targetAudience: 'Leads',
    courseType: 'IP',
    programCode: 'j',
    title: formatCourseTitle('IP', 'j'),
    whatsappTemplate: DEFAULT_COURSE_WHATSAPP_TEMPLATE,
    isActive: true,
    hasImage: false,
    imageUrl: '',
    createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-08-01T12:00:00.000Z',
    createdBy: 'volunteer@example.com',
    updatedBy: 'volunteer@example.com'
  },
  {
    id: 'crsIpSnr01AbcDefGhiJK',
    activityType: 'Course',
    targetAudience: 'Leads',
    courseType: 'IP',
    programCode: 's',
    title: formatCourseTitle('IP', 's'),
    whatsappTemplate: DEFAULT_COURSE_WHATSAPP_TEMPLATE,
    isActive: true,
    hasImage: false,
    imageUrl: '',
    createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-08-01T12:00:00.000Z',
    createdBy: 'volunteer@example.com',
    updatedBy: 'volunteer@example.com'
  },
  {
    id: 'crsVtpNc01AbcDefGhiJK',
    activityType: 'Course',
    targetAudience: 'Leads',
    courseType: 'VTP',
    programCode: '',
    title: formatCourseTitle('VTP', ''),
    whatsappTemplate: DEFAULT_COURSE_WHATSAPP_TEMPLATE,
    isActive: true,
    hasImage: false,
    imageUrl: '',
    createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-08-01T12:00:00.000Z',
    createdBy: 'volunteer@example.com',
    updatedBy: 'volunteer@example.com'
  },
  {
    id: 'evtSats01AbcDefGhiJKL',
    activityType: 'Event',
    targetAudience: 'Members',
    courseType: '',
    programCode: '',
    title: 'Weekly Member Follow-up',
    whatsappTemplate: DEFAULT_EVENT_WHATSAPP_TEMPLATE,
    isActive: true,
    hasImage: false,
    imageUrl: '',
    createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-08-01T12:00:00.000Z',
    createdBy: 'volunteer@example.com',
    updatedBy: 'volunteer@example.com'
  }
];
