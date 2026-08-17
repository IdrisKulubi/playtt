#!/usr/bin/env node
import { randomUUID } from "node:crypto"
import { createInterface } from "node:readline"
import { join } from "node:path"

import { DeviceV1Client, DeviceProtocolError } from "../protocol/client.mjs"
import { createCredentialStore } from "../protocol/credentials.mjs"
import { createDebouncer } from "../protocol/debounce.mjs"
import { createEventBuffer } from "../protocol/event-buffer.mjs"
import { flushEventBuffer } from "../protocol/runtime.mjs"
import { sleep } from "../protocol/retry.mjs"

const FIRMWARE_VERSION = "simulator-v1.0.0"
const DEFAULT_HEARTBEAT_MS = 15_000

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {Record<string, string | boolean | string[]>} */
  const options = {
    press: [],
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === "--press") {
      const value = argv[index + 1]
      if (!value) {
        throw new Error("--press requires a side value.")
      }
      /** @type {string[]} */ (options.press).push(value)
      index += 1
      continue
    }

    if (arg.startsWith("--")) {
      const key = arg.slice(2)
      const value = argv[index + 1]

      if (!value || value.startsWith("--")) {
        options[key] = true
        continue
      }

      options[key] = value
      index += 1
    }
  }

  return options
}

function usage() {
  console.log(`Usage: node firmware/simulator/cli.mjs [options]

Options:
  --base-url <url>            PlayTT base URL (default: http://localhost:3000)
  --enrollment-code <code>    One-time enrollment code from operator UI
  --hardware-uid <id>         Stable hardware identifier
  --state-file <path>         Credential state file path
  --reprovision               Ignore stored credentials and provision again
  --heartbeat-ms <ms>         Heartbeat interval (default: 15000)
  --offline-ms <ms>           Simulate offline for N ms before replay
  --drop-once                 Fail the next network request once
  --press <a|b|u>             Queue a score press (repeatable)
  --interactive               Read a/b/u presses from stdin until EOF
  --help                      Show this help
`)
}

/**
 * @param {string | boolean | undefined} side
 */
function normalizePress(side) {
  const value = String(side).trim().toLowerCase()

  if (value === "a" || value === "b") {
    return { kind: "point", side: value, delta: 1 }
  }

  if (value === "u") {
    return { kind: "correction", side: "a", delta: -1 }
  }

  throw new Error(`Unsupported press value: ${side}`)
}

/**
 * @param {DeviceV1Client} client
 * @param {ReturnType<typeof createEventBuffer>} buffer
 * @param {ReturnType<typeof createDebouncer>} debouncer
 * @param {{ kind: "point" | "correction", side: "a" | "b", delta: number }} press
 */
async function queuePress(client, buffer, debouncer, press) {
  if (!debouncer.shouldAcceptPress(press.side)) {
    console.log(`[simulator] debounced ${press.side}`)
    return
  }

  const event = buffer.enqueue(press)
  console.log(
    `[simulator] queued seq=${event.sequence} kind=${event.kind} side=${event.side} delta=${event.delta}`,
  )

  await flushEventBuffer(client, buffer)
}

/**
 * @param {DeviceV1Client} client
 * @param {number | undefined} appliedConfigVersion
 */
async function pollCommands(client, appliedConfigVersion) {
  const body = await client.listCommands()
  const commands = body.data?.commands ?? []

  for (const command of commands) {
    const idempotencyKey = `ack:${command.id}:${command.attemptCount ?? 1}`
    await client.acknowledgeCommand(command.id, {
      idempotencyKey,
      success: true,
      result: {
        appliedConfigVersion,
      },
    })
    console.log(`[simulator] ack command ${command.id} (${command.kind})`)
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    usage()
    return
  }

  const baseUrl = String(options["base-url"] ?? "http://localhost:3000")
  const hardwareUid = String(options["hardware-uid"] ?? "sim-table-01")
  const stateFile = String(
    options["state-file"] ??
      join(import.meta.dirname, ".state", `${hardwareUid}.json`),
  )
  const heartbeatMs = Number(options["heartbeat-ms"] ?? DEFAULT_HEARTBEAT_MS)
  const offlineMs = Number(options["offline-ms"] ?? 0)
  const bootId = randomUUID()
  const startedAt = Date.now()

  const store = createCredentialStore(stateFile)
  const client = new DeviceV1Client({ baseUrl })
  const buffer = createEventBuffer(bootId)
  const debouncer = createDebouncer()

  let dropOnce = Boolean(options["drop-once"])
  const originalRequest = client.request.bind(client)

  client.request = async (path, requestOptions = {}) => {
    if (dropOnce) {
      dropOnce = false
      client.setOffline(true)
      await sleep(10)
      client.setOffline(false)
      throw new DeviceProtocolError(
        "NETWORK_ERROR",
        "Simulated WAN blip.",
        0,
      )
    }

    return originalRequest(path, requestOptions)
  }

  let credentials = options.reprovision ? null : store.load()

  if (!credentials) {
    const enrollmentCode = String(options["enrollment-code"] ?? "")

    if (!enrollmentCode) {
      throw new Error("--enrollment-code is required when no stored credentials exist.")
    }

    const provisioned = await client.provision({
      enrollmentCode,
      hardwareUid,
      firmwareVersion: FIRMWARE_VERSION,
    })

    credentials = {
      deviceId: provisioned.deviceId,
      secret: provisioned.secret,
      credentialVersion: provisioned.credentialVersion,
      hardwareUid,
    }

    store.save(credentials)
    console.log(`[simulator] provisioned device ${credentials.deviceId}`)
  } else {
    client.setCredentials(credentials)
    console.log(`[simulator] loaded device ${credentials.deviceId}`)
  }

  const configBody = await client.getConfig()
  let appliedConfigVersion = configBody.data?.configVersion ?? undefined
  console.log(
    `[simulator] config v${appliedConfigVersion ?? "unknown"} role=${configBody.data?.role ?? "unknown"}`,
  )

  await client.heartbeat({
    bootId,
    firmwareVersion: FIRMWARE_VERSION,
    uptimeMs: Date.now() - startedAt,
    appliedConfigVersion,
  })

  await pollCommands(client, appliedConfigVersion)

  const scriptedPresses = /** @type {string[]} */ (options.press).map(normalizePress)

  if (offlineMs > 0 && scriptedPresses.length > 0) {
    client.setOffline(true)
    for (const press of scriptedPresses) {
      if (debouncer.shouldAcceptPress(press.side)) {
        const event = buffer.enqueue(press)
        console.log(`[simulator] offline queued seq=${event.sequence}`)
      }
    }
    await sleep(offlineMs)
    client.setOffline(false)
    await flushEventBuffer(client, buffer)
  } else {
    for (const press of scriptedPresses) {
      await queuePress(client, buffer, debouncer, press)
    }
  }

  if (options.interactive) {
    const rl = createInterface({ input: process.stdin, output: process.stdout })

    for await (const line of rl) {
      const token = line.trim().toLowerCase()
      if (!token) {
        continue
      }

      if (token === "q") {
        break
      }

      await queuePress(client, buffer, debouncer, normalizePress(token))
    }
  }

  const endAt = Date.now() + heartbeatMs

  while (Date.now() < endAt) {
    await sleep(Math.min(1_000, endAt - Date.now()))
  }

  await client.heartbeat({
    bootId,
    firmwareVersion: FIRMWARE_VERSION,
    uptimeMs: Date.now() - startedAt,
    appliedConfigVersion,
  })

  await pollCommands(client, appliedConfigVersion)

  if (buffer.size() > 0) {
    await flushEventBuffer(client, buffer)
  }

  console.log("[simulator] done")
}

main().catch((error) => {
  console.error("[simulator] failed:", error instanceof Error ? error.message : error)
  process.exitCode = 1
})
