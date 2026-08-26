export type AccessErrorCode =
  | "ACCESS_NOT_FOUND"
  | "ACCESS_NOT_READY"
  | "ACCESS_NOT_ELIGIBLE"
  | "ACCESS_CONFIGURATION_ERROR"
  | "ACCESS_PROVIDER_UNAVAILABLE"
  | "ACCESS_FORBIDDEN"

export class AccessDomainError extends Error {
  constructor(
    readonly code: AccessErrorCode,
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = "AccessDomainError"
  }
}
