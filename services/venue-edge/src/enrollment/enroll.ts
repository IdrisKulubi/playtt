import { randomUUID } from "node:crypto"
import { arch, platform } from "node:os"

import type { CredentialManager } from "../auth/credential-manager"
import type { EdgeV1Client } from "../cloud/client"
import { EdgeProtocolError } from "../cloud/client"
import { safeLog } from "../health/metrics"

export interface EnrollVenueEdgeInput {
  pairingCode: string
  credentialManager: CredentialManager
  client: EdgeV1Client
  agentVersion: string
  bootId: string
  displayName?: string
}

export interface EnrollVenueEdgeResult {
  deviceId: string
  installationId: string
  credentialVersion: number
  status: "online"
}

function resolveInstallationUid(existing?: string | null): string {
  if (existing) {
    return existing
  }

  return randomUUID()
}

export async function confirmPendingEnrollment(
  client: EdgeV1Client,
): Promise<{ deviceId: string; status: "online"; alreadyConfirmed: boolean } | null> {
  if (!client.deviceId || !client.secret) {
    return null
  }

  try {
    const confirmed = await client.confirmEnrollment()
    if (!confirmed.alreadyConfirmed) {
      safeLog("info", "Enrollment confirmed", {
        deviceId: confirmed.deviceId,
        status: confirmed.status,
      })
    }
    return confirmed
  } catch (error) {
    if (
      error instanceof EdgeProtocolError &&
      (error.code === "PAIRING_HEARTBEAT_REQUIRED" ||
        error.status === 409)
    ) {
      return null
    }

    throw error
  }
}

export async function enrollVenueEdge(
  input: EnrollVenueEdgeInput,
): Promise<EnrollVenueEdgeResult> {
  const existing = await input.credentialManager.loadCredentials()
  if (existing) {
    throw new Error(
      "This VenueEdge installation is already enrolled. Start the agent without a pairing code.",
    )
  }

  const metadata = await input.credentialManager.loadInstallationMetadata()
  if (metadata?.revokedAt) {
    throw new Error(
      "This installation was revoked. Create a replace-host pairing code from /nvr.",
    )
  }

  const installationUid = resolveInstallationUid(metadata?.installationUid)
  const exchanged = await input.client.exchangeEnrollment({
    pairingCode: input.pairingCode,
    installationUid,
    platform: platform(),
    architecture: arch(),
    agentVersion: input.agentVersion,
    displayName: input.displayName,
  })

  await input.credentialManager.persistCredentials({
    deviceId: exchanged.deviceId,
    secret: exchanged.secret,
    credentialVersion: exchanged.credentialVersion,
    installationUid,
  })

  input.client.setCredentials({
    deviceId: exchanged.deviceId,
    secret: exchanged.secret,
  })

  await input.client.heartbeat({
    bootId: input.bootId,
    firmwareVersion: input.agentVersion,
    uptimeMs: 0,
    appliedConfigVersion: 1,
  })

  const confirmed = await confirmPendingEnrollment(input.client)
  if (!confirmed) {
    throw new Error("Enrollment confirmation failed after heartbeat.")
  }

  safeLog("info", "VenueEdge enrollment complete", {
    deviceId: exchanged.deviceId,
    installationId: exchanged.installationId,
    status: confirmed.status,
  })

  return {
    deviceId: exchanged.deviceId,
    installationId: exchanged.installationId,
    credentialVersion: exchanged.credentialVersion,
    status: confirmed.status,
  }
}
