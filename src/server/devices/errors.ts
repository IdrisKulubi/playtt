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
  | "COMMAND_NOT_FOUND"
  | "COMMAND_EXPIRED"
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
