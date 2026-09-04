import { z } from 'zod';
import type { ResourceDefinition } from './contracts.js';

const TaskValueSchema = z.object({
  id: z.string(),
  title: z.string().trim().min(1).max(160),
  status: z.enum(['open', 'done']),
  ownerEmail: z.email(),
  attachmentPath: z.string(),
  attachmentUrl: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

const CreateTaskSchema = z
  .object({ title: z.string().trim().min(1).max(160) })
  .transform((value) => ({
    ...value,
    status: 'open',
    ownerEmail: '',
    attachmentPath: '',
    attachmentUrl: '',
    id: '',
    createdAt: '',
    updatedAt: ''
  }));

export const taskResource: ResourceDefinition = {
  key: 'tasks',
  sheet: 'Tasks',
  headers: [
    'id',
    'title',
    'status',
    'ownerEmail',
    'attachmentPath',
    'attachmentUrl',
    'createdAt',
    'updatedAt'
  ],
  aliases: {
    ownerEmail: ['owner', 'email'],
    updatedAt: ['version', 'lastUpdated']
  },
  idColumn: 'id',
  versionColumn: 'updatedAt',
  ownerColumn: 'ownerEmail',
  policy: 'owner',
  schema: TaskValueSchema,
  createSchema: CreateTaskSchema,
  editableFields: ['title', 'status', 'attachmentPath', 'attachmentUrl'],
  seedRows: []
};

export const appManifest = {
  name: 'Alpine Vercel App Kit',
  allowedUsersSheet: 'AllowedUsers',
  allowedUsersHeaders: ['email', 'name'],
  resources: [taskResource]
} as const;

export function getResourceDefinition(key: string): ResourceDefinition | null {
  return appManifest.resources.find((resource) => resource.key === key) || null;
}
