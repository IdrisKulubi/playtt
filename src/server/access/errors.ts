import type { AccessFailureKind } from "./types.ts"

export class AccessProviderError extends Error {
  readonly kind: AccessFailureKind
  readonly retryAfterSeconds: number | null

  constructor(
    kind: AccessFailureKind,
    message: string,
    options: { cause?: unknown; retryAfterSeconds?: number | null } = {},
  ) {
    super(message, { cause: options.cause })
    this.name = "AccessProviderError"
    this.kind = kind
    this.retryAfterSeconds = options.retryAfterSeconds ?? null
  }
}
