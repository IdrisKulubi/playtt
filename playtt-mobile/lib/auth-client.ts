import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import { emailOTPClient, twoFactorClient } from 'better-auth/client/plugins';
import * as SecureStore from 'expo-secure-store';

import { getApiBaseUrl } from '@/lib/env';

export const authClient = createAuthClient({
  baseURL: getApiBaseUrl(),
  plugins: [
    expoClient({
      scheme: 'playtt',
      storagePrefix: 'playtt',
      storage: SecureStore,
    }),
    twoFactorClient(),
    emailOTPClient(),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;

export async function refreshSession() {
  return authClient.getSession();
}
