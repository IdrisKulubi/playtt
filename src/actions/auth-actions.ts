"use server";

const authBaseUrl =
  process.env.BETTER_AUTH_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "http://localhost:3000";

type ActionResult =
  | { success: true }
  | { success: false; message: string };

async function postToAuth(path: string, payload: Record<string, unknown>) {
  const response = await fetch(`${authBaseUrl}/api/auth/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const text = await response.text();
  const data = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    const message =
      getErrorMessage(data) ||
      `Auth request failed with status ${response.status}`;

    throw new Error(message);
  }

  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new Error(getErrorMessage(data) || "Auth request failed");
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
      if (
        error instanceof Error &&
        error.message.includes("status 404")
      ) {
        lastError = error;
        continue;
      }

      throw error;
    }
  }

  throw (
    lastError ||
    new Error("Auth request failed because no matching endpoint was found.")
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
  if (!data || typeof data !== "object") {
    return null;
  }

  const candidate =
    ("message" in data && typeof data.message === "string" && data.message) ||
    ("error" in data &&
      typeof data.error === "object" &&
      data.error !== null &&
      "message" in data.error &&
      typeof data.error.message === "string" &&
      data.error.message);

  return candidate || null;
}

export async function sendVerificationEmailAction(
  email: string,
): Promise<ActionResult> {
  if (!email) {
    return { success: false, message: "Email is required." };
  }

  try {
    await postToAuth("email-otp/send-verification-otp", {
      email,
      type: "email-verification",
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to send verification email.",
    };
  }
}

export async function requestPasswordResetAction(
  email: string,
): Promise<ActionResult> {
  if (!email) {
    return { success: false, message: "Email is required." };
  }

  try {
    await postToAuthWithFallbacks(
      ["forget-password", "forgot-password", "request-password-reset"],
      {
      email,
      redirectTo: `${authBaseUrl}/reset-password/confirm`,
      },
    );

    return { success: true };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to send password reset email.",
    };
  }
}

export async function resetPasswordAction(input: {
  token: string;
  newPassword: string;
}): Promise<ActionResult> {
  if (!input.token) {
    return { success: false, message: "Reset token is required." };
  }

  if (!input.newPassword) {
    return { success: false, message: "New password is required." };
  }

  try {
    await postToAuthWithFallbacks(
      ["reset-password", "change-password", "confirm-password-reset"],
      {
        token: input.token,
        newPassword: input.newPassword,
      },
    );

    return { success: true };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to reset password.",
    };
  }
}
