import { randomUUID } from "node:crypto"

import { and, eq, lt, or, sql } from "drizzle-orm"

import db from "@/db/drizzle"
import { ttlockConnections } from "@/db/schema"
import {
  decryptCredentialSecret,
  encryptCredentialSecret,
  ttlockConnectionSecretAad,
} from "@/server/access/encryption"
import { AccessProviderError } from "@/server/access/errors"
import { SimulatedAccessProvider } from "@/server/access/simulated-access-provider"
import {
  refreshTtlockOAuthToken,
  TtlockAccessProvider,
} from "@/server/access/ttlock-client"
import type { AccessProvider } from "@/server/access/types"

const simulators = new Map<string, SimulatedAccessProvider>()

async function getConnection(tenantId: string, connectionId: string) {
  const [connection] = await db
    .select()
    .from(ttlockConnections)
    .where(
      and(
        eq(ttlockConnections.tenantId, tenantId),
        eq(ttlockConnections.id, connectionId),
      ),
    )
    .limit(1)
  if (!connection) {
    throw new AccessProviderError(
      "configuration_terminal",
      "TTLock connection was not found.",
    )
  }
  return connection
}

function decryptConnectionValue(
  connection: Awaited<ReturnType<typeof getConnection>>,
  purpose: "client-secret" | "access-token" | "refresh-token",
) {
  const value =
    purpose === "client-secret"
      ? connection.encryptedClientSecret
      : purpose === "access-token"
        ? connection.encryptedAccessToken
        : connection.encryptedRefreshToken
  if (!value) {
    throw new AccessProviderError(
      "authentication_refreshable",
      `TTLock ${purpose} is unavailable.`,
    )
  }
  return decryptCredentialSecret(
    value,
    ttlockConnectionSecretAad(connection.tenantId, connection.id, purpose),
  )
}

export async function refreshTtlockConnectionTokens(
  tenantId: string,
  connectionId: string,
) {
  const leaseOwner = randomUUID()
  const now = new Date()
  const leasedUntil = new Date(now.getTime() + 30_000)
  const [claimed] = await db
    .update(ttlockConnections)
    .set({ refreshLeaseOwner: leaseOwner, refreshLeasedUntil: leasedUntil })
    .where(
      and(
        eq(ttlockConnections.tenantId, tenantId),
        eq(ttlockConnections.id, connectionId),
        or(
          sql`${ttlockConnections.refreshLeasedUntil} is null`,
          lt(ttlockConnections.refreshLeasedUntil, now),
        ),
      ),
    )
    .returning()

  if (!claimed) {
    throw new AccessProviderError(
      "authentication_refreshable",
      "TTLock token refresh is already in progress.",
    )
  }

  try {
    const token = await refreshTtlockOAuthToken({
      baseUrl: claimed.apiBaseUrl,
      clientId: claimed.clientId,
      clientSecret: decryptConnectionValue(claimed, "client-secret"),
      refreshToken: decryptConnectionValue(claimed, "refresh-token"),
    })
    const accessEnvelope = encryptCredentialSecret(
      token.accessToken,
      ttlockConnectionSecretAad(tenantId, connectionId, "access-token"),
    )
    const refreshEnvelope = encryptCredentialSecret(
      token.refreshToken,
      ttlockConnectionSecretAad(tenantId, connectionId, "refresh-token"),
    )
    await db
      .update(ttlockConnections)
      .set({
        encryptedAccessToken: accessEnvelope,
        accessTokenKeyVersion: accessEnvelope.split(".", 1)[0],
        encryptedRefreshToken: refreshEnvelope,
        refreshTokenKeyVersion: refreshEnvelope.split(".", 1)[0],
        accessTokenExpiresAt: new Date(Date.now() + token.expiresInSeconds * 1000),
        status: "active",
        refreshLeaseOwner: null,
        refreshLeasedUntil: null,
        lastErrorCode: null,
      })
      .where(
        and(
          eq(ttlockConnections.id, connectionId),
          eq(ttlockConnections.refreshLeaseOwner, leaseOwner),
        ),
      )
    return token
  } catch (error) {
    await db
      .update(ttlockConnections)
      .set({
        refreshLeaseOwner: null,
        refreshLeasedUntil: null,
        lastErrorCode: "token_refresh_failed",
      })
      .where(
        and(
          eq(ttlockConnections.id, connectionId),
          eq(ttlockConnections.refreshLeaseOwner, leaseOwner),
        ),
      )
    throw error
  }
}

export async function getAccessProviderForConnection(
  tenantId: string,
  connectionId: string,
): Promise<AccessProvider> {
  if (process.env.TTLOCK_PROVIDER_MODE !== "real") {
    let provider = simulators.get(connectionId)
    if (!provider) {
      provider = new SimulatedAccessProvider()
      simulators.set(connectionId, provider)
    }
    return provider
  }

  const connection = await getConnection(tenantId, connectionId)
  if (connection.status !== "active") {
    throw new AccessProviderError(
      "configuration_terminal",
      connection.status === "reauth_required"
        ? "TTLock connection requires reauthentication."
        : "TTLock connection is not active.",
    )
  }
  return new TtlockAccessProvider({
    baseUrl: connection.apiBaseUrl,
    token: async () => {
      const latest = await getConnection(tenantId, connectionId)
      return {
        clientId: latest.clientId,
        accessToken: decryptConnectionValue(latest, "access-token"),
      }
    },
    refreshToken: async () => {
      const token = await refreshTtlockConnectionTokens(tenantId, connectionId)
      return { clientId: connection.clientId, accessToken: token.accessToken }
    },
  })
}
