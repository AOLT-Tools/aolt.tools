import { AuthenticatedUserSchema } from '../../shared/contracts/appContracts.js';
import {
  createGoogleOAuthFlow,
  resolveGoogleRedirectUri,
  type GoogleTokenPayload
} from '@aolt/integrations/auth/oauth';
import { getOAuthEnv, getServerEnv } from '../env.js';

function getRedirectUri() {
  return resolveGoogleRedirectUri(
    getServerEnv().GOOGLE_REDIRECT_URI,
    '/api/seva/auth/callback'
  );
}

const googleOAuth = createGoogleOAuthFlow({
  userSchema: AuthenticatedUserSchema,
  getCredentials() {
    const env = getOAuthEnv();
    return {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: getRedirectUri()
    };
  },
  createInvalidIdentityError(message) {
    return new Error(message);
  }
});

export function createOAuthState() {
  return googleOAuth.createOAuthState(32);
}

export function buildGoogleAuthUrl(state: string, nonce: string) {
  return googleOAuth.buildGoogleAuthUrl(state, { nonce });
}

export function getUserFromAuthCode(code: string, expectedNonce: string) {
  return googleOAuth.getUserFromAuthCode(code, {
    expectedNonce,
    requireEmailVerified: true,
    validatePayload(payload: GoogleTokenPayload) {
      if (payload.iss !== 'https://accounts.google.com') {
        throw new Error('Google identity could not be verified.');
      }
    }
  });
}
