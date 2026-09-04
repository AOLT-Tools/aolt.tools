import { describe, expect, it } from 'vitest';
import { taskResource } from '../examples/app-manifest.js';
import {
  findHeaderIndex,
  getTabName,
  parseJsonValue,
  parseRows,
  resolveHeaders,
  rowsToConfigMap,
  rowsToTable,
  toRow
} from '@aolt/integrations/sheets/table';

const record = {
  id: 'task-1',
  title: 'Test headers',
  status: 'open',
  ownerEmail: 'developer@example.com',
  attachmentPath: '',
  attachmentUrl: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
};

describe('schema-driven Sheets tables', () => {
  it('accepts unordered columns and declared aliases', () => {
    const headers = [
      'title',
      'id',
      'status',
      'owner',
      'attachmentPath',
      'attachmentUrl',
      'createdAt',
      'lastUpdated'
    ];
    const row = toRow(headers, taskResource, record);
    expect(parseRows([headers, row], taskResource)[0].value).toEqual(record);
  });

  it('fails closed when a required column is absent', () => {
    expect(() => resolveHeaders(['id', 'title'], taskResource)).toThrow(
      'Sheet schema is missing required columns.'
    );
  });

  it('supports low-level row helpers for app-specific sheet stores', () => {
    expect(getTabName('Leads!A:Z')).toBe('Leads');
    expect(findHeaderIndex(['Email', 'Name'], ['ownerEmail', 'email'])).toBe(0);
    expect(parseJsonValue('{"enabled":true}', { enabled: false })).toEqual({
      enabled: true
    });
    expect(
      rowsToConfigMap([
        ['key', 'value'],
        ['theme', 'quiet']
      ])
    ).toEqual({
      theme: 'quiet'
    });
    expect(
      rowsToTable([
        ['email', 'name'],
        [' developer@example.com ', ' Developer '],
        ['', '']
      ]).records
    ).toEqual([
      {
        rowNumber: 2,
        values: [' developer@example.com ', ' Developer '],
        record: { email: 'developer@example.com', name: 'Developer' }
      }
    ]);
  });
});
