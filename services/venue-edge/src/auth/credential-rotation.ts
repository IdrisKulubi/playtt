import type { EdgeV1Client } from "../cloud/client"
import { safeLog } from "../health/metrics"
import type { CredentialManager } from "./credential-manager"

export async function rotateDeviceCredentialsWithOverlap(input: {
  client: EdgeV1Client
  credentialManager: CredentialManager
}): Promise<{ credentialVersion: number; previousVersion: number }> {
  const current = await input.credentialManager.loadCredentials()
  if (!current) {
    throw new Error("Device credentials are not configured.")
  }

  const rotated = await input.client.rotateCredential()
  const previousSecret = current.secret
  const previousVersion = rotated.previousVersion ?? current.credentialVersion ?? 1

  try {
    await input.credentialManager.persistCredentials({
      deviceId: current.deviceId,
      secret: rotated.secret,
      credentialVersion: rotated.credentialVersion,
    })
    input.client.setCredentials({
      deviceId: current.deviceId,
      secret: rotated.secret,
    })

    await input.client.acknowledgeCredentialRotation()

    safeLog("info", "Device credential rotation acknowledged", {
      credentialVersion: rotated.credentialVersion,
      previousVersion,
    })

    return {
      credentialVersion: rotated.credentialVersion,
      previousVersion,
    }
  } catch (error) {
    safeLog("warn", "Credential rotation persist failed; rolling back", {
      message: error instanceof Error ? error.message : String(error),
    })

    input.client.setCredentials({
      deviceId: current.deviceId,
      secret: previousSecret,
    })

    await input.client.rollbackCredentialRotation()

    throw error
  }
}
