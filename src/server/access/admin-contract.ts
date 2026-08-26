export type TtlockRegion = "global" | "eu"

export type AccessConnectionSummary = {
  id: string
  name: string
  region: TtlockRegion
  status: string
  tokenHealth: string
  lastSyncAt: string | null
}

export type AccessGatewaySummary = {
  id: string
  connectionId: string
  name: string
  online: boolean
  lastSeenAt: string | null
}

export type AccessLockSummary = {
  id: string
  connectionId: string
  gatewayId: string | null
  accessPointId: string | null
  name: string
  online: boolean
  supportsCustomPasscodes: boolean
  passcodeVersion: number | null
  batteryLevel: number | null
}

export type AccessPointOption = {
  id: string
  name: string
  kind: string
  locationId: string
}

export type AccessGrantSummary = {
  id: string
  bookingId: string
  locationId: string
  status: string
  credentialCount: number
  activeCredentialCount: number
  validFrom: string
  validUntil: string
  lastError: string | null
  updatedAt: string
}

export type AccessOperationsSnapshot = {
  connections: AccessConnectionSummary[]
  gateways: AccessGatewaySummary[]
  locks: AccessLockSummary[]
  accessPoints: AccessPointOption[]
  grants: AccessGrantSummary[]
}

export const accessAdminNoStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  Vary: "Cookie, Authorization, x-tenant-id",
}
