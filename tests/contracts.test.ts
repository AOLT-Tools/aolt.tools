import { describe, expect, it } from 'vitest';
import { ResourceRecordSchema } from '@aolt/shared/contracts';
import { taskResource } from '../examples/app-manifest.js';

describe('shared contracts', () => {
  it('applies domain defaults through the replaceable create schema', () => {
    const value = taskResource.createSchema.parse({ title: '  Ship starter  ' });
    expect(value).toMatchObject({
      title: 'Ship starter',
      status: 'open',
      attachmentPath: ''
    });
  });

  it('rejects records without stable IDs and versions', () => {
    expect(() =>
      ResourceRecordSchema.parse({ title: 'missing system fields' })
    ).toThrow();
  });
});
