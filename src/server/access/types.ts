export type AccessGrantStatus =
  | "configuring"
  | "ready"
  | "temporarily_unavailable"
  | "action_required"
  | "revoking"
  | "revoked"
  | "expired"

export type AccessCredentialStatus =
  | "pending"
  | "provisioning"
  | "active"
  | "modifying"
  | "retrying"
  | "revoking"
  | "revoked"
  | "expired"
  | "failed"

export type AccessFailureKind =
  | "retryable"
  | "authentication_refreshable"
  | "rate_limited"
  | "offline"
  | "collision"
  | "configuration_terminal"
  | "unknown"

export interface AccessProviderTarget {
  credentialId: string
  externalLockId: string
  passcode: string
  passcodeName: string
  validFrom: Date
  validUntil: Date
}

export interface AccessProviderCredential {
  externalCredentialId: string
  externalLockId: string
  passcodeName: string
  validFrom: Date
  validUntil: Date
  status: "active" | "pending" | "expired" | "failed" | "unknown"
}

export interface AccessProviderHealth {
  ok: boolean
  checkedAt: Date
  message?: string
}

export interface AccessProviderInventory {
  gateways: Array<{
    externalGatewayId: string
    macAddress: string | null
    online: boolean
    lockCount: number
  }>
  locks: Array<{
    externalLockId: string
    externalGatewayIds: string[]
    name: string
    alias: string | null
    macAddress: string | null
    batteryLevel: number | null
    passcodeVersion: number | null
    hasGateway: boolean
  }>
}

export interface AccessProvider {
  provision(target: AccessProviderTarget): Promise<AccessProviderCredential>
  modify(
    credential: AccessProviderCredential,
    input: Pick<AccessProviderTarget, "passcode" | "validFrom" | "validUntil">,
  ): Promise<AccessProviderCredential>
  revoke(credential: AccessProviderCredential): Promise<void>
  query(
    externalLockId: string,
    passcodeName: string,
  ): Promise<AccessProviderCredential | null>
  reconcile(credential: AccessProviderCredential): Promise<AccessProviderCredential | null>
  inventory(): Promise<AccessProviderInventory>
  health(): Promise<AccessProviderHealth>
  remoteUnlock(externalLockId: string): Promise<void>
}

export interface RelayCommandInput {
  tenantId: string
  venueId: string
  resourceId: string
  playSessionId: string
  correlationId: string
  channel: string
  desiredState: "on" | "off" | "warning" | "reset"
  expiresAt: Date
  idempotencyKey: string
}

export interface RelayProvider {
  execute(input: RelayCommandInput): Promise<{ commandId: string }>
}
