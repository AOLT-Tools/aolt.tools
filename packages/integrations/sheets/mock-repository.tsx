import { nanoid } from 'nanoid';
import type {
  Actor,
  DataRepository,
  ResourceDefinition
} from '@aolt/core/contracts';
import { AppError } from '@aolt/core/errors';
import type { ResourceRecord, ResourceValue } from '@aolt/shared/contracts';
import { canAccess } from './table.js';

const initialTime = '2026-01-01T00:00:00.000Z';

export class MockDataRepository implements DataRepository {
  private readonly records = new Map<string, ResourceRecord[]>([
    [
      'tasks',
      [
        {
          id: 'example-task',
          title: 'Replace this example with your first domain module',
          status: 'open',
          ownerEmail: 'developer@example.com',
          attachmentPath: '',
          attachmentUrl: '',
          createdAt: initialTime,
          updatedAt: initialTime
        }
      ]
    ]
  ]);

  async isUserAllowed(email: string) {
    return email.toLowerCase() === 'developer@example.com';
  }

  async list(resource: ResourceDefinition, actor: Actor) {
    return (this.records.get(resource.key) || []).filter((record) =>
      canAccess(resource.policy, resource, record, actor)
    );
  }

  async get(resource: ResourceDefinition, id: string, actor: Actor) {
    const record =
      (this.records.get(resource.key) || []).find((value) => value.id === id) || null;
    if (record && !canAccess(resource.policy, resource, record, actor)) {
      throw new AppError('FORBIDDEN', 'You cannot access this record.', 403);
    }
    return record ? { ...record } : null;
  }

  async create(resource: ResourceDefinition, input: ResourceValue, actor: Actor) {
    const parsed = resource.createSchema.parse(input);
    const now = new Date().toISOString();
    const value: ResourceValue = {
      ...parsed,
      [resource.idColumn]: nanoid(),
      createdAt: now,
      [resource.versionColumn]: now
    };
    if (resource.ownerColumn) value[resource.ownerColumn] = actor.email.toLowerCase();
    const record = resource.schema.parse(value) as ResourceRecord;
    const list = this.records.get(resource.key) || [];
    this.records.set(resource.key, [...list, record]);
    return { ...record };
  }

  async update(
    resource: ResourceDefinition,
    id: string,
    input: ResourceValue,
    expectedVersion: string,
    actor: Actor
  ) {
    const list = this.records.get(resource.key) || [];
    const index = list.findIndex((record) => record.id === id);
    if (index < 0) throw new AppError('NOT_FOUND', 'Record not found.', 404);
    const current = list[index];
    if (!canAccess(resource.policy, resource, current, actor)) {
      throw new AppError('FORBIDDEN', 'You cannot update this record.', 403);
    }
    if (String(current[resource.versionColumn]) !== expectedVersion) {
      throw new AppError(
        'CONFLICT',
        'This record changed. Refresh and try again.',
        409
      );
    }
    const changes = Object.fromEntries(
      resource.editableFields
        .filter((field) => input[field] !== undefined)
        .map((field) => [field, input[field]])
    );
    const next = resource.schema.parse({
      ...current,
      ...changes,
      [resource.versionColumn]: new Date().toISOString()
    }) as ResourceRecord;
    list[index] = next;
    return { ...next };
  }

  async remove(
    resource: ResourceDefinition,
    id: string,
    expectedVersion: string,
    actor: Actor
  ) {
    const list = this.records.get(resource.key) || [];
    const index = list.findIndex((record) => record.id === id);
    if (index < 0) throw new AppError('NOT_FOUND', 'Record not found.', 404);
    const current = list[index];
    if (!canAccess(resource.policy, resource, current, actor)) {
      throw new AppError('FORBIDDEN', 'You cannot delete this record.', 403);
    }
    if (String(current[resource.versionColumn]) !== expectedVersion) {
      throw new AppError(
        'CONFLICT',
        'This record changed. Refresh and try again.',
        409
      );
    }
    list.splice(index, 1);
  }
}
