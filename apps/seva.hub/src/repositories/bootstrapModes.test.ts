import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../services/apiClient';
import { HttpLeadRepository } from './http';
import { mockBootstrapData } from './mock/mockData';

describe('bootstrap request modes', () => {
  afterEach(() => vi.restoreAllMocks());

  it('requests lightweight metadata explicitly for lead entry', async () => {
    const client = new ApiClient('');
    const get = vi.spyOn(client, 'get').mockResolvedValue({
      ...mockBootstrapData,
      campaignId: 'all',
      leads: []
    });
    const result = await new HttpLeadRepository(client).getBootstrap('all', true);
    const request = new URL(String(get.mock.calls[0][0]), 'https://example.test');
    expect(request.pathname).toBe('/api/seva/bootstrap');
    expect(request.searchParams.get('metadataOnly')).toBe('1');
    expect(request.searchParams.get('campaignId')).toBe('all');
    expect(result.leads).toEqual([]);
  });

  it('keeps normal bootstrap requests unchanged', async () => {
    const client = new ApiClient('');
    const get = vi.spyOn(client, 'get').mockResolvedValue(mockBootstrapData);
    await new HttpLeadRepository(client).getBootstrap('all');
    const request = new URL(String(get.mock.calls[0][0]), 'https://example.test');
    expect(request.searchParams.has('metadataOnly')).toBe(false);
    expect(request.searchParams.get('campaignId')).toBe('all');
  });
});
