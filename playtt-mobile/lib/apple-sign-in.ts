import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

export class AppleSignInCanceledError extends Error {
  constructor() {
    super('Apple sign in was canceled.');
    this.name = 'AppleSignInCanceledError';
  }
}

export type AppleSignInResult = {
  identityToken: string;
  rawNonce: string;
  fullName: string | null;
};

export async function isAppleSignInAvailable() {
  return AppleAuthentication.isAvailableAsync();
}

function formatAppleFullName(
  fullName: AppleAuthentication.AppleAuthenticationFullName | null,
) {
  if (!fullName) {
    return null;
  }

  const parts = [fullName.givenName, fullName.familyName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : null;
}

export async function signInWithApple(): Promise<AppleSignInResult> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      ],
      nonce: hashedNonce,
    });

    if (!credential.identityToken) {
      throw new Error('Apple sign in did not return an identity token.');
    }

    return {
      identityToken: credential.identityToken,
      rawNonce,
      fullName: formatAppleFullName(credential.fullName),
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
