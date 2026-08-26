import { AccessProviderError } from "./errors.ts"
import type {
  AccessProvider,
  AccessProviderCredential,
  AccessProviderHealth,
  AccessProviderInventory,
  AccessProviderTarget,
} from "./types.ts"

export type SimulatedAccessScenario =
  | "success"
  | "lost_response_once"
  | "collision"
  | "timeout"
  | "rate_limited"
  | "token_expired"
  | "gateway_offline"
  | "unsupported_lock"

export class SimulatedAccessProvider implements AccessProvider {
  readonly #credentials = new Map<string, AccessProviderCredential>()
  readonly #scenario: SimulatedAccessScenario
  readonly #ambiguousResponses = new Set<string>()

  constructor(scenario: SimulatedAccessScenario = "success") {
    this.#scenario = scenario
  }

  #throwScenario(target: AccessProviderTarget) {
    if (this.#scenario === "collision") {
      throw new AccessProviderError("collision", "Passcode is already assigned.")
    }
    if (this.#scenario === "timeout") {
      throw new AccessProviderError("retryable", "Provider request timed out.")
    }
    if (this.#scenario === "rate_limited") {
      throw new AccessProviderError("rate_limited", "Provider rate limit reached.", {
        retryAfterSeconds: 30,
      })
    }
    if (this.#scenario === "token_expired") {
      throw new AccessProviderError(
        "authentication_refreshable",
        "Provider authentication must be refreshed.",
      )
    }
    if (this.#scenario === "gateway_offline") {
      throw new AccessProviderError("offline", "Gateway is offline.")
    }
    if (this.#scenario === "unsupported_lock") {
      throw new AccessProviderError(
        "configuration_terminal",
        "Lock does not support remote custom passcodes.",
      )
    }
    if (
      this.#scenario === "lost_response_once" &&
      !this.#ambiguousResponses.has(target.passcodeName)
    ) {
      this.#ambiguousResponses.add(target.passcodeName)
      throw new AccessProviderError("retryable", "Provider response was lost.")
    }
  }

  async provision(target: AccessProviderTarget) {
    const existing = await this.query(target.externalLockId, target.passcodeName)
    if (existing) return existing

    const credential: AccessProviderCredential = {
      externalCredentialId: `sim:${target.credentialId}`,
      externalLockId: target.externalLockId,
      passcodeName: target.passcodeName,
      validFrom: target.validFrom,
      validUntil: target.validUntil,
      status: "active",
    }
    this.#credentials.set(target.passcodeName, credential)
    this.#throwScenario(target)
    return credential
  }

  async modify(
    credential: AccessProviderCredential,
    input: Pick<AccessProviderTarget, "passcode" | "validFrom" | "validUntil">,
  ) {
    const updated = {
      ...credential,
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      status: "active" as const,
    }
    this.#credentials.set(credential.passcodeName, updated)
    return updated
  }

  async revoke(credential: AccessProviderCredential) {
    this.#credentials.delete(credential.passcodeName)
  }

  async query(externalLockId: string, passcodeName: string) {
    const credential = this.#credentials.get(passcodeName)
    return credential?.externalLockId === externalLockId ? credential : null
  }

  async reconcile(credential: AccessProviderCredential) {
    return this.query(credential.externalLockId, credential.passcodeName)
  }

  async inventory(): Promise<AccessProviderInventory> {
    return {
      gateways: [
        {
          externalGatewayId: "sim-gateway-1",
          macAddress: "00:00:00:00:00:01",
          online: this.#scenario !== "gateway_offline",
          lockCount: 2,
        },
      ],
      locks: ["sim-lock-entrance", "sim-lock-resource"].map((id) => ({
        externalLockId: id,
        externalGatewayIds: ["sim-gateway-1"],
        name: id,
        alias: null,
        macAddress: null,
        batteryLevel: 100,
        passcodeVersion: this.#scenario === "unsupported_lock" ? 3 : 4,
        hasGateway: true,
      })),
    }
  }

  async health(): Promise<AccessProviderHealth> {
    return {
      ok: this.#scenario !== "gateway_offline",
      checkedAt: new Date(),
      message: this.#scenario === "gateway_offline" ? "Gateway is offline." : undefined,
    }
  }

  async remoteUnlock(externalLockId: string) {
    if (!externalLockId) {
      throw new AccessProviderError("configuration_terminal", "Lock ID is required.")
    }
    if (this.#scenario === "gateway_offline") {
      throw new AccessProviderError("offline", "Gateway is offline.")
    }
  }
}
