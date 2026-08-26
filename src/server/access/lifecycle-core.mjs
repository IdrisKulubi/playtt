const RETRYABLE_KINDS = new Set([
  "retryable",
  "authentication_refreshable",
  "rate_limited",
  "offline",
  "unknown",
])

export function accessRetryDelaySeconds(attempt, retryAfterSeconds = null) {
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(3600, Math.ceil(retryAfterSeconds))
  }
  return Math.min(3600, 15 * 2 ** Math.max(0, attempt - 1))
}

export async function provisionAccessGrant({ grant, credentials, providerFor, repository }) {
  let retryableFailure = false
  let terminalFailure = false

  for (const credential of credentials) {
    if (["active", "modifying"].includes(credential.status)) continue
    if (credential.attemptCount >= credential.maxAttempts) {
      terminalFailure = true
      await repository.markCredentialFailed(credential, {
        kind: "unknown",
        message: "Access credential exhausted its retry attempts.",
      })
      continue
    }

    const provider = await providerFor(credential)
    await repository.markCredentialProvisioning(credential)
    try {
      const existing = await provider.query(
        credential.externalLockId,
        credential.stableName,
      )
      const result =
        existing ??
        (await provider.provision({
          credentialId: credential.id,
          externalLockId: credential.externalLockId,
          passcode: grant.passcode,
          passcodeName: credential.stableName,
          validFrom: grant.validFrom,
          validUntil: grant.validUntil,
        }))
      await repository.markCredentialActive(credential, result)
    } catch (error) {
      const kind = typeof error?.kind === "string" ? error.kind : "unknown"
      if (RETRYABLE_KINDS.has(kind)) {
        retryableFailure = true
        await repository.markCredentialRetrying(credential, {
          kind,
          message: error instanceof Error ? error.message : "Access provider failed.",
          delaySeconds: accessRetryDelaySeconds(
            credential.attemptCount + 1,
            error?.retryAfterSeconds,
          ),
        })
      } else {
        terminalFailure = true
        await repository.markCredentialFailed(credential, {
          kind,
          message: error instanceof Error ? error.message : "Access provider failed.",
        })
      }
    }
  }

  const current = await repository.listCredentials(grant.id)
  if (current.length > 0 && current.every((item) => item.status === "active")) {
    await repository.markGrantReady(grant)
    return "ready"
  }
  if (terminalFailure || current.some((item) => item.status === "failed")) {
    await repository.markGrantActionRequired(grant)
    return "action_required"
  }
  if (retryableFailure || current.some((item) => item.status === "retrying")) {
    await repository.markGrantTemporarilyUnavailable(grant)
    return "temporarily_unavailable"
  }
  return grant.status
}

export async function revokeAccessGrant({
  grant,
  credentials,
  providerFor,
  repository,
  credentialFilter = null,
}) {
  let retryableFailure = false
  for (const credential of credentials) {
    if (credentialFilter && !credentialFilter(credential)) continue
    if (["revoked", "expired"].includes(credential.status)) continue
    if (!credential.externalCredentialId) {
      await repository.markCredentialRevoked(credential)
      continue
    }
    const provider = await providerFor(credential)
    try {
      await provider.revoke({
        externalCredentialId: credential.externalCredentialId,
        externalLockId: credential.externalLockId,
        passcodeName: credential.stableName,
        validFrom: grant.validFrom,
        validUntil: grant.validUntil,
        status: "active",
      })
      await repository.markCredentialRevoked(credential)
    } catch (error) {
      retryableFailure = true
      await repository.markCredentialRetrying(credential, {
        kind: error?.kind ?? "unknown",
        message: error instanceof Error ? error.message : "Access revoke failed.",
        delaySeconds: accessRetryDelaySeconds(
          credential.attemptCount + 1,
          error?.retryAfterSeconds,
        ),
      })
    }
  }

  const current = await repository.listCredentials(grant.id)
  if (current.every((item) => ["revoked", "expired"].includes(item.status))) {
    await repository.markGrantRevoked(grant)
    return "revoked"
  }
  if (retryableFailure) await repository.markGrantRevoking(grant)
  return "revoking"
}

export async function modifyAccessGrant({ grant, credentials, providerFor, repository }) {
  let retryableFailure = false
  let terminalFailure = false

  for (const credential of credentials) {
    if (!["active", "modifying", "retrying"].includes(credential.status)) continue
    if (!credential.externalCredentialId) {
      terminalFailure = true
      await repository.markCredentialFailed(credential, {
        kind: "unknown",
        message: "Active credential is missing provider reference.",
      })
      continue
    }

    const provider = await providerFor(credential)
    await repository.markCredentialModifying(credential)
    try {
      const result = await provider.modify(
        {
          externalCredentialId: credential.externalCredentialId,
          externalLockId: credential.externalLockId,
          passcodeName: credential.stableName,
          validFrom: credential.validFrom,
          validUntil: credential.validUntil,
          status: "active",
        },
        {
          passcode: grant.passcode,
          validFrom: grant.validFrom,
          validUntil: grant.validUntil,
        },
      )
      await repository.markCredentialActive(credential, result)
    } catch (error) {
      const kind = typeof error?.kind === "string" ? error.kind : "unknown"
      if (RETRYABLE_KINDS.has(kind)) {
        retryableFailure = true
        await repository.markCredentialRetrying(credential, {
          kind,
          message: error instanceof Error ? error.message : "Access modify failed.",
          delaySeconds: accessRetryDelaySeconds(
            credential.attemptCount + 1,
            error?.retryAfterSeconds,
          ),
        })
      } else {
        terminalFailure = true
        await repository.markCredentialFailed(credential, {
          kind,
          message: error instanceof Error ? error.message : "Access modify failed.",
        })
      }
    }
  }

  const current = await repository.listCredentials(grant.id)
  const activeCredentials = current.filter((item) =>
    ["active", "modifying", "retrying", "pending", "provisioning"].includes(item.status),
  )
  if (
    activeCredentials.length > 0 &&
    activeCredentials.every((item) => item.status === "active")
  ) {
    await repository.markGrantReady(grant)
    return "ready"
  }
  if (terminalFailure || current.some((item) => item.status === "failed")) {
    await repository.markGrantActionRequired(grant)
    return "action_required"
  }
  if (retryableFailure || current.some((item) => item.status === "retrying")) {
    await repository.markGrantTemporarilyUnavailable(grant)
    return "temporarily_unavailable"
  }
  return grant.status
}
