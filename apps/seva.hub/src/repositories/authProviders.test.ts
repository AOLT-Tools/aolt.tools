import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../services/apiClient';
import { HttpAuthProvider } from './http';
import { MockAuthProvider } from './mock/mockAuthProvider';

describe('auth provider sign-out', () => {
  it('posts to the API sign-out endpoint in API mode', async () => {
    const apiClient = new ApiClient('');
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({
      success: true
    });
    const provider = new HttpAuthProvider(apiClient);

    await provider.signOut();

    expect(post).toHaveBeenCalledWith('/api/seva/auth/signout', {});
  });

  it('clears and can restore the mock session', async () => {
    const provider = new MockAuthProvider();

    expect(await provider.getSessionUser()).not.toBeNull();
    await provider.signOut();
    expect(await provider.getSessionUser()).toBeNull();
    await provider.signIn();
    expect(await provider.getSessionUser()).not.toBeNull();
  });
});
