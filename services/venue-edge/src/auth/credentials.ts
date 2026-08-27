export interface DeviceCredentials {
  deviceId: string
  secret: string
  credentialVersion?: number
  installationUid?: string
}

export function redactCredentialValue(value: string): string {
  if (value.length <= 4) {
    return "[redacted]"
  }

  return `${value.slice(0, 2)}…[redacted]`
}
