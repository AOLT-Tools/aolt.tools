import { OAuth2Client } from 'google-auth-library';
import { nanoid } from 'nanoid';
import type { z } from 'zod';
import { UserSchema } from '@aolt/shared/contracts';
import { getAuthEnv } from '@aolt/core/env';
import { AppError } from '@aolt/core/errors';

export type GoogleOAuthCredentials = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type GoogleTokenPayload = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  nonce?: string;
  iss?: string;
};

export type GoogleAuthUrlOptions = {
  accessType?: 'online' | 'offline';
  scopes?: readonly string[];
  includeGrantedScopes?: boolean;
  prompt?: string;
  nonce?: string;
};

export type GoogleCodeExchangeOptions = {
  expectedNonce?: string;
  requireEmailVerified?: boolean;
  validatePayload?: (payload: GoogleTokenPayload) => void;
  mapUser?: (payload: GoogleTokenPayload) => unknown;
};

export type GoogleOAuthFlowOptions<TUser> = {
  userSchema: z.ZodType<TUser>;
  getCredentials: () => GoogleOAuthCredentials;
  createInvalidIdentityError?: (message: string) => Error;
};

export function resolveGoogleRedirectUri(
  explicitRedirectUri: string | undefined,
  callbackPath = '/api/auth/callback'
): string {
  if (explicitRedirectUri) {
    return explicitRedirectUri;
  }

  const host = process.env.VERCEL_URL;
  if (!host) {
    throw new Error('GOOGLE_REDIRECT_URI or VERCEL_URL is required.');
  }
  return 'https://' + host + callbackPath;
}

function defaultUser(payload: GoogleTokenPayload) {
  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture
  };
}

export function createGoogleOAuthFlow<TUser>(options: GoogleOAuthFlowOptions<TUser>) {
  function invalidIdentityError(message: string): Error {
    return options.createInvalidIdentityError?.(message) || new Error(message);
  }

  function client() {
    const credentials = options.getCredentials();
    return new OAuth2Client(
      credentials.clientId,
      credentials.clientSecret,
      credentials.redirectUri
    );
  }

  function createState(size = 32): string {
    return nanoid(size);
  }

  function buildGoogleAuthUrl(
    state: string,
    authOptions: GoogleAuthUrlOptions = {}
  ): string {
    return client().generateAuthUrl({
      access_type: authOptions.accessType || 'online',
      scope: [...(authOptions.scopes || ['openid', 'email', 'profile'])],
      include_granted_scopes: authOptions.includeGrantedScopes ?? true,
      prompt: authOptions.prompt || 'select_account',
      state,
      ...(authOptions.nonce ? { nonce: authOptions.nonce } : {})
    });
  }

  async function getUserFromAuthCode(
    code: string,
    exchangeOptions: GoogleCodeExchangeOptions = {}
  ): Promise<TUser> {
    const credentials = options.getCredentials();
    const oauth = client();
    const tokenResponse = await oauth.getToken(code);
    const idToken = tokenResponse.tokens.id_token;
    if (!idToken) {
      throw invalidIdentityError('Missing id_token from Google OAuth response.');
    }

    const ticket = await oauth.verifyIdToken({
      idToken,
      audience: credentials.clientId
    });

    const payload = ticket.getPayload() as GoogleTokenPayload | undefined;
    if (!payload) {
      throw invalidIdentityError('Unable to read Google token payload.');
    }
    if (exchangeOptions.requireEmailVerified && payload.email_verified !== true) {
      throw invalidIdentityError('Google email address is not verified.');
    }
    if (
      exchangeOptions.expectedNonce !== undefined &&
      payload.nonce !== exchangeOptions.expectedNonce
    ) {
      throw invalidIdentityError('Google OAuth nonce could not be verified.');
    }
    exchangeOptions.validatePayload?.(payload);

    return options.userSchema.parse((exchangeOptions.mapUser || defaultUser)(payload));
  }

  return {
    createOAuthState: createState,
    buildGoogleAuthUrl,
    getUserFromAuthCode
  };
}

const frameworkOAuthFlow = createGoogleOAuthFlow({
  userSchema: UserSchema,
  getCredentials() {
    const env = getAuthEnv();
    return {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: env.GOOGLE_REDIRECT_URI
    };
  },
  createInvalidIdentityError(message) {
    return new AppError('FORBIDDEN', message, 403);
  }
});

export function createOAuthState(): string {
  return frameworkOAuthFlow.createOAuthState(32);
}

export function createOAuthNonce(): string {
  return nanoid(32);
}

export function buildGoogleAuthUrl(state: string, nonce: string): string {
  return frameworkOAuthFlow.buildGoogleAuthUrl(state, { nonce });
}

export async function exchangeGoogleCode(code: string, expectedNonce: string) {
  return frameworkOAuthFlow.getUserFromAuthCode(code, {
    expectedNonce,
    requireEmailVerified: true,
    validatePayload(payload) {
      if (payload.iss !== 'https://accounts.google.com') {
        throw new AppError('FORBIDDEN', 'Google identity could not be verified.', 403);
      }
    },
    mapUser(payload) {
      return {
        id: payload.sub,
        email: payload.email,
        name: payload.name || payload.email,
        picture: payload.picture
      };
    }
  });
}
