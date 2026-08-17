export type TenancyErrorCode =
  | "MEMBERSHIP_NOT_FOUND"
  | "MEMBERSHIP_DISABLED"
  | "FORBIDDEN_TENANT"
  | "FORBIDDEN_ACTION"
  | "NOT_AUTHENTICATED"
  | "DEVICE_CONTEXT_UNSUPPORTED"

export class TenancyError extends Error {
  readonly code: TenancyErrorCode

  constructor(code: TenancyErrorCode, message: string) {
    super(message)
    this.name = "TenancyError"
    this.code = code
  }
}
