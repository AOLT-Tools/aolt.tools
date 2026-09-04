import type { AuthProvider } from '../contracts';
import type { AuthenticatedUser } from '../../../shared/contracts/appContracts';
import { mockBootstrapData } from './mockData';

export class MockAuthProvider implements AuthProvider {
  private currentUser: AuthenticatedUser | null = mockBootstrapData.user;

  async getSessionUser(): Promise<AuthenticatedUser | null> {
    return this.currentUser;
  }

  async signIn(): Promise<AuthenticatedUser> {
    this.currentUser = mockBootstrapData.user;
    return this.currentUser;
  }

  async signOut(): Promise<void> {
    this.currentUser = null;
  }
}
