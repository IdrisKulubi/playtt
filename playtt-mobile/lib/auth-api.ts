import type { AppleSignInResult } from '@/lib/apple-sign-in';
import { ApiError } from '@/lib/api-error';
import { formatApiFailure, getFriendlyErrorMessage } from '@/lib/api-errors';
import { getApiBaseUrl } from '@/lib/env';

export type AuthApiResult =
  | { success: true }
  | { success: false; message: string };

export type AppleAuthUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
};

export type AppleAuthResponse = {
  user: AppleAuthUser;
  token: string;
  isNewUser: boolean;
};

async function postToAuth(path: string, payload: Record<string, unknown>) {
  const response = await fetch(`${getApiBaseUrl()}/api/auth/${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  const data = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    const rawMessage =
      getErrorMessage(data) || `Auth request failed with status ${response.status}`;
    throw new ApiError({
      status: response.status,
      code: getErrorCode(data),
      data,
      message: formatApiFailure({
        status: response.status,
        code: getErrorCode(data),
        message: rawMessage,
      }),
    });
  }

  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(getErrorMessage(data) || 'Auth request failed');
  }

  return data;
}

async function postToAuthWithFallbacks(
  paths: string[],
  payload: Record<string, unknown>,
) {
  let lastError: Error | null = null;

  for (const path of paths) {
    try {
      return await postToAuth(path, payload);
    } catch (error) {
      if (error instanceof Error && error.message.includes('status 404')) {
        lastError = error;
        continue;
      }

      throw error;
    }
  }

  throw (
    lastError || new Error('Auth request failed because no matching endpoint was found.')
  );
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getErrorMessage(data: unknown) {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const candidate =
    ('message' in data && typeof data.message === 'string' && data.message) ||
    ('error' in data &&
      typeof data.error === 'object' &&
      data.error !== null &&
      'message' in data.error &&
      typeof data.error.message === 'string' &&
      data.error.message);

  return candidate || null;
}

export async function signInWithAppleApi(
  credential: AppleSignInResult,
): Promise<AppleAuthResponse> {
  const response = await fetch(`${getApiBaseUrl()}/api/apple/sign-in`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      identityToken: credential.identityToken,
      authorizationCode: credential.authorizationCode ?? undefined,
      email: credential.email ?? undefined,
      fullName: credential.fullName ?? undefined,
    }),
  });

  const text = await response.text();
  const data = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    const rawMessage =
      getErrorMessage(data) || `Apple sign in failed with status ${response.status}`;
    throw new ApiError({
      status: response.status,
      code: getErrorCode(data),
      data,
      message: formatApiFailure({
        status: response.status,
        code: getErrorCode(data),
        message: rawMessage,
      }),
    });
  }

  if (
    !data ||
    typeof data !== 'object' ||
    !('success' in data) ||
    !data.success ||
    !('data' in data) ||
    !data.data ||
    typeof data.data !== 'object'
  ) {
    throw new Error('Apple sign in returned an unexpected response.');
  }

  const payload = data.data as Record<string, unknown>;
  const user = payload.user;
  const token = payload.token;

  if (
    !user ||
    typeof user !== 'object' ||
    typeof token !== 'string' ||
    !token.trim()
  ) {
    throw new Error('Apple sign in returned an invalid session.');
  }

  const userRecord = user as Record<string, unknown>;

  return {
    user: {
      id: String(userRecord.id),
      name: String(userRecord.name ?? 'User'),
      email: String(userRecord.email),
      emailVerified: Boolean(userRecord.emailVerified),
      image:
        typeof userRecord.image === 'string' ? userRecord.image : null,
    },
    token,
    isNewUser: Boolean(payload.isNewUser),
  };
}

export async function sendVerificationOtp(email: string): Promise<AuthApiResult> {
  if (!email) {
    return { success: false, message: 'Email is required.' };
  }

  try {
    await postToAuth('email-otp/send-verification-otp', {
      email,
      type: 'email-verification',
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      message: getFriendlyErrorMessage(
        error,
        'Failed to send verification email.',
      ),
    };
  }
}

export async function requestPasswordReset(email: string): Promise<AuthApiResult> {
  if (!email) {
    return { success: false, message: 'Email is required.' };
  }

  try {
    await postToAuth('email-otp/request-password-reset', { email });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      message: getFriendlyErrorMessage(
        error,
        'Failed to send password reset code.',
      ),
    };
  }
}

function getErrorCode(data: unknown) {
  if (!data || typeof data !== 'object') {
    return undefined;
  }

  const record = data as Record<string, unknown>;
  return typeof record.code === 'string' ? record.code : undefined;
}
