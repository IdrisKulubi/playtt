import type { DeviceCommandBus } from "@/server/devices/command-bus"

import type { RelayCommandInput, RelayProvider } from "./types.ts"

export class SimulatedRelayProvider implements RelayProvider {
  readonly #commands = new Map<string, { commandId: string }>()

  async execute(input: RelayCommandInput) {
    const existing = this.#commands.get(input.idempotencyKey)
    if (existing) return existing
    if (input.expiresAt <= new Date()) throw new Error("Relay command has expired.")

    const created = { commandId: `sim-relay:${input.idempotencyKey}` }
    this.#commands.set(input.idempotencyKey, created)
    return created
  }
}

export class DeviceCommandRelayProvider implements RelayProvider {
  readonly #bus: DeviceCommandBus
  readonly #resolveDeviceId: (
    input: RelayCommandInput,
  ) => Promise<string>

  constructor(
    bus: DeviceCommandBus,
    resolveDeviceId: (
      input: RelayCommandInput,
    ) => Promise<string>,
  ) {
    this.#bus = bus
    this.#resolveDeviceId = resolveDeviceId
  }

  async execute(input: RelayCommandInput) {
    if (input.expiresAt <= new Date()) throw new Error("Relay command has expired.")
    const deviceId = await this.#resolveDeviceId(input)
    const expiresInSeconds = Math.max(
      1,
      Math.floor((input.expiresAt.getTime() - Date.now()) / 1000),
    )
    const command = await this.#bus.enqueue({
      tenantId: input.tenantId,
      deviceId,
      kind: "set_output",
      payload: {
        venueId: input.venueId,
        resourceId: input.resourceId,
        playSessionId: input.playSessionId,
        channel: input.channel,
        desiredState: input.desiredState,
        idempotencyKey: input.idempotencyKey,
      },
      expiresInSeconds,
      correlationId: input.correlationId,
      causationId: input.idempotencyKey,
    })
    return { commandId: command.id }
  }
}
