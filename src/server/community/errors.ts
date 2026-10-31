export type CommunityErrorCode =
  | "COMMUNITY_PROFILE_REQUIRED"
  | "PLAYER_NOT_FOUND"
  | "CANNOT_TARGET_SELF"
  | "NO_HOME_VENUE"
  | "WINDOW_PASSED"
  | "RATE_LIMITED"

export class CommunityError extends Error {
  readonly code: CommunityErrorCode
  readonly status: number

  constructor(code: CommunityErrorCode, message: string, status = 400) {
    super(message)
    this.name = "CommunityError"
    this.code = code
    this.status = status
  }
}

export function isCommunityError(error: unknown): error is CommunityError {
  return error instanceof CommunityError
}
