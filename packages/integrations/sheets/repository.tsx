import { nanoid } from 'nanoid';
import type {
  Actor,
  DataRepository,
  ResourceDefinition
} from '@aolt/core/contracts';
import { AppError } from '@aolt/core/errors';
import type { ResourceRecord, ResourceValue } from '@aolt/shared/contracts';
import { appManifest } from '@aolt/core/manifest';
import { SheetsClient } from './client.js';
import { canAccess, columnLabel, parseRows, toRow } from './table.js';

export class SheetsRepository implements DataRepository {
  constructor(private readonly client = new SheetsClient()) {}

  async isUserAllowed(email: string): Promise<boolean> {
    const rows = await this.client.read(
      'access',
      appManifest.allowedUsersSheet + '!A:Z'
    );
    const emailIndex = (rows[0] || []).findIndex(
      (header) => header.trim().toLowerCase() === 'email'
    );
    if (emailIndex < 0) return false;
    return rows.slice(1).some(
      (row) =>
        String(row[emailIndex] || '')
          .trim()
          .toLowerCase() === email.trim().toLowerCase()
    );
  }

  private async readTable(resource: ResourceDefinition) {
    const rows = await this.client.read('data', resource.sheet + '!A:ZZ');
    if (!rows.length) {
      throw new AppError(
        'UPSTREAM_ERROR',
        'Resource sheet has no header row.',
        502,
        false,
        'sheet_schema'
      );
    }
    return { headers: rows[0], records: parseRows(rows, resource) };
  }

  async list(resource: ResourceDefinition, actor: Actor) {
    const table = await this.readTable(resource);
    return table.records
      .filter(({ value }) => canAccess(resource.policy, resource, value, actor))
      .map(({ value }) => value);
  }

  async get(resource: ResourceDefinition, id: string, actor: Actor) {
    const table = await this.readTable(resource);
    const record = table.records.find(({ value }) => value.id === id)?.value || null;
    if (record && !canAccess(resource.policy, resource, record, actor)) {
      throw new AppError('FORBIDDEN', 'You cannot access this record.', 403);
    }
    return record;
  }

  async create(resource: ResourceDefinition, input: ResourceValue, actor: Actor) {
    const parsed = resource.createSchema.parse(input);
    const table = await this.readTable(resource);
    const now = new Date().toISOString();
    const value: ResourceValue = {
      ...parsed,
      [resource.idColumn]: nanoid(),
      createdAt: now,
      [resource.versionColumn]: now
    };
    if (resource.ownerColumn) value[resource.ownerColumn] = actor.email.toLowerCase();
    const record = resource.schema.parse(value) as ResourceRecord;
    await this.client.append(
      'data',
      resource.sheet + '!A:ZZ',
      toRow(table.headers, resource, record)
    );
    return record;
  }

  async update(
    resource: ResourceDefinition,
    id: string,
    input: ResourceValue,
    expectedVersion: string,
    actor: Actor
  ) {
    const table = await this.readTable(resource);
    const current = table.records.find(({ value }) => value.id === id);
    if (!current) throw new AppError('NOT_FOUND', 'Record not found.', 404);
    if (!canAccess(resource.policy, resource, current.value, actor)) {
      throw new AppError('FORBIDDEN', 'You cannot update this record.', 403);
    }
    if (String(current.value[resource.versionColumn]) !== expectedVersion) {
      throw new AppError(
        'CONFLICT',
        'This record changed. Refresh and try again.',
        409,
        false,
        'optimistic_conflict'
      );
    }
    const changes = Object.fromEntries(
      resource.editableFields
        .filter((field) => input[field] !== undefined)
        .map((field) => [field, input[field]])
    );
    const next = resource.schema.parse({
      ...current.value,
      ...changes,
      [resource.versionColumn]: new Date().toISOString()
    }) as ResourceRecord;
    const lastColumn = columnLabel(table.headers.length);
    await this.client.update('data', [
      {
        range:
          resource.sheet +
          '!A' +
          current.rowNumber +
          ':' +
          lastColumn +
          current.rowNumber,
        values: [toRow(table.headers, resource, next)]
      }
    ]);
    return next;
  }

  async remove(
    resource: ResourceDefinition,
    id: string,
    expectedVersion: string,
    actor: Actor
  ) {
    const table = await this.readTable(resource);
    const current = table.records.find(({ value }) => value.id === id);
    if (!current) throw new AppError('NOT_FOUND', 'Record not found.', 404);
    if (!canAccess(resource.policy, resource, current.value, actor)) {
      throw new AppError('FORBIDDEN', 'You cannot delete this record.', 403);
    }
    if (String(current.value[resource.versionColumn]) !== expectedVersion) {
      throw new AppError(
        'CONFLICT',
        'This record changed. Refresh and try again.',
        409
      );
    }
    await this.client.deleteRow('data', resource.sheet, current.rowNumber);
  }
}
