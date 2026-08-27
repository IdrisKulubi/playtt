import type { CredentialManager } from "../auth/credential-manager"

export type SetupEnrollmentStatus = "enrolled" | "not_enrolled" | "revoked"

export interface SetupStatusPayload {
  enrollmentStatus: SetupEnrollmentStatus
  setupLocked: boolean
  expiresAt: string | null
}

export async function resolveSetupEnrollmentStatus(
  credentialManager: CredentialManager,
): Promise<SetupEnrollmentStatus> {
  if (await credentialManager.isRevoked()) {
    return "revoked"
  }

  const credentials = await credentialManager.loadCredentials()
  if (credentials?.deviceId) {
    return "enrolled"
  }

  return "not_enrolled"
}

export function buildSetupStatusPayload(input: {
  enrollmentStatus: SetupEnrollmentStatus
  setupLocked: boolean
  expiresAt: Date | null
}): SetupStatusPayload {
  return {
    enrollmentStatus: input.enrollmentStatus,
    setupLocked: input.setupLocked,
    expiresAt: input.expiresAt ? input.expiresAt.toISOString() : null,
  }
}
