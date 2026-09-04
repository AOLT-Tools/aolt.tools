import { describe, expect, it } from 'vitest';
import { taskResource } from '../examples/app-manifest.js';
import { MockDataRepository } from '@aolt/integrations/sheets/mock-repository';

const actor = {
  id: 'developer',
  email: 'developer@example.com',
  name: 'Developer',
  csrfToken: 'csrf'
};

describe('mock and production repository contract', () => {
  it('supports versioned CRUD without external credentials', async () => {
    const repository = new MockDataRepository();
    const created = await repository.create(taskResource, { title: 'Test' }, actor);
    const updated = await repository.update(
      taskResource,
      created.id,
      { status: 'done' },
      created.updatedAt,
      actor
    );
    expect(updated.status).toBe('done');
    await repository.remove(taskResource, updated.id, updated.updatedAt, actor);
    expect(await repository.get(taskResource, updated.id, actor)).toBeNull();
  });

  it('rejects stale optimistic versions', async () => {
    const repository = new MockDataRepository();
    const created = await repository.create(taskResource, { title: 'Test' }, actor);
    await expect(
      repository.update(taskResource, created.id, { status: 'done' }, 'stale', actor)
    ).rejects.toThrow('changed');
  });
});
