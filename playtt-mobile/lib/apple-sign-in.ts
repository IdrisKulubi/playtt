import * as AppleAuthentication from 'expo-apple-authentication';

import { authDebug, authDebugError } from '@/lib/auth-debug';

export class AppleSignInCanceledError extends Error {
  constructor() {
    super('Apple sign in was canceled.');
    this.name = 'AppleSignInCanceledError';
  }
}

export type AppleSignInResult = {
  identityToken: string;
  authorizationCode: string | null;
  email: string | null;
  fullName: AppleAuthentication.AppleAuthenticationFullName | null;
};

export async function isAppleSignInAvailable() {
  return AppleAuthentication.isAvailableAsync();
}

export async function signInWithApple(): Promise<AppleSignInResult> {
  authDebug('apple-native:start')

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      ],
    });

    if (!credential.identityToken) {
      authDebugError('apple-native:missing-token', new Error('No identity token from Apple'))
      throw new Error('Apple sign in did not return an identity token.');
    }

    authDebug('apple-native:success', {
      hasAuthorizationCode: Boolean(credential.authorizationCode),
      hasEmail: Boolean(credential.email),
      hasFullName: Boolean(credential.fullName),
      identityTokenLength: credential.identityToken.length,
    })

    return {
      identityToken: credential.identityToken,
      authorizationCode: credential.authorizationCode ?? null,
      email: credential.email ?? null,
      fullName: credential.fullName,
    };
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ERR_REQUEST_CANCELED'
    ) {
      authDebug('apple-native:canceled')
      throw new AppleSignInCanceledError();
    }

    authDebugError('apple-native:failed', error)
    throw error;
  }
}
