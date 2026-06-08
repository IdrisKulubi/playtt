import { getApiBaseUrl } from '@/lib/env';

export type AuthApiResult =
  | { success: true }
  | { success: false; message: string };

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
    const message =
      getErrorMessage(data) || `Auth request failed with status ${response.status}`;
    throw new Error(message);
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
      message:
        error instanceof Error ? error.message : 'Failed to send verification email.',
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
      message:
        error instanceof Error ? error.message : 'Failed to send password reset code.',
    };
  }
}
