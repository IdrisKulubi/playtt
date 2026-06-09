import * as AppleAuthentication from 'expo-apple-authentication';

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
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      ],
    });

    if (!credential.identityToken) {
      throw new Error('Apple sign in did not return an identity token.');
    }

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
      throw new AppleSignInCanceledError();
    }

    throw error;
  }
}
