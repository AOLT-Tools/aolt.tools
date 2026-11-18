import {
  AuthenticatedUserSchema,
  type AuthenticatedUser
} from '../../shared/contracts/appContracts.js';
import { createJwtSessionManager } from '@aolt/integrations/auth/session';
import { getServerEnv } from '../env.js';

const SESSION_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

export type SessionUser = AuthenticatedUser;

const sessionManager = createJwtSessionManager<SessionUser>({
  userSchema: AuthenticatedUserSchema,
  getSecrets: () => getServerEnv().SESSION_SECRET,
  getCookieName: () => getServerEnv().SESSION_COOKIE_NAME,
  getTtlSeconds: () => SESSION_COOKIE_MAX_AGE,
  expireToken: false,
  secureCookie: () => process.env.NODE_ENV === 'production'
});

export const createSessionToken = sessionManager.createSessionToken;
export const readSessionUser = sessionManager.readSessionUser;
export const setSessionCookie = sessionManager.setSessionCookie;
export const clearSessionCookie = sessionManager.clearSessionCookie;
