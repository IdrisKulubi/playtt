export type DeviceErrorCode =
  | "DEVICE_UNAUTHENTICATED"
  | "DEVICE_FORBIDDEN"
  | "DEVICE_REVOKED"
  | "DEVICE_NOT_FOUND"
  | "ENROLLMENT_EXPIRED"
  | "ENROLLMENT_CONSUMED"
  | "ENROLLMENT_INVALID"
  | "ASSIGNMENT_CONFLICT"
  | "ASSIGNMENT_NOT_FOUND"
  | "ASSIGNMENT_STALE"
  | "DEVICE_ROLE_UNSUPPORTED"
  | "CONFIG_VERSION_INVALID"
  | "CONFIG_NOT_READY"
  | "CONFIG_INVALID"
  | "AGENT_VERSION_REQUIRED"
  | "AGENT_UPGRADE_REQUIRED"
  | "COMMAND_NOT_FOUND"
  | "COMMAND_EXPIRED"
  | "SESSION_INACTIVE"
  | "SEQUENCE_GAP"
  | "RULESET_UNSUPPORTED"
  | "SCORE_FORBIDDEN"
  | "PROVISION_RATE_LIMITED"
  | "VALIDATION_ERROR"

export class DeviceError extends Error {
  readonly code: DeviceErrorCode
  readonly status: number

  constructor(code: DeviceErrorCode, message: string, status = 400) {
    super(message)
    this.name = "DeviceError"
    this.code = code
    this.status = status
  }
}
