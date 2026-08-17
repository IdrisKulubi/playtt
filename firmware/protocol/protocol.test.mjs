import assert from "node:assert/strict"
import { createServer } from "node:http"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { DeviceV1Client } from "./client.mjs"
import { createDebouncer } from "./debounce.mjs"
import { createEventBuffer } from "./event-buffer.mjs"
import { flushEventBuffer } from "./runtime.mjs"
import { isDuplicateScoreSuccess, isRetryableDeviceError } from "./retry.mjs"

const protocolRoot = import.meta.dirname

/**
 * @param {(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse, body: unknown) => void} handler
 */
function createMockServer(handler) {
  const server = createServer(async (req, res) => {
    const chunks = []

    for await (const chunk of req) {
      chunks.push(chunk)
    }

    const raw = Buffer.concat(chunks).toString("utf8")
    const body = raw ? JSON.parse(raw) : null

    handler(req, res, body)
  })

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") {
        throw new Error("Unable to bind mock server.")
      }

      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) => {
              if (error) {
                closeReject(error)
                return
              }

              closeResolve(undefined)
            })
          }),
      })
    })
  })
}

test("debounce collapses rapid presses on the same side", () => {
  const debouncer = createDebouncer(80)
  const now = 1_000

  assert.equal(debouncer.shouldAcceptPress("a", now), true)
  assert.equal(debouncer.shouldAcceptPress("a", now + 10), false)
  assert.equal(debouncer.shouldAcceptPress("b", now + 10), true)
  assert.equal(debouncer.shouldAcceptPress("a", now + 100), true)
})

test("event buffer preserves monotonic boot sequences", () => {
  const buffer = createEventBuffer("boot-1")

  const first = buffer.enqueue({ side: "a" })
  const second = buffer.enqueue({ side: "b" })

  assert.equal(first.sequence, 1)
  assert.equal(second.sequence, 2)
  assert.equal(buffer.peek()?.sequence, 1)
  buffer.ack()
  assert.equal(buffer.peek()?.sequence, 2)
})

test("offline buffer replays in order and accepts duplicate success", async () => {
  /** @type {Array<{ bootId: string, sequence: number, side: string }>} */
  const sent = []
  let calls = 0

  const mock = await createMockServer((req, res, body) => {
    if (req.url === "/api/device/v1/events" && req.method === "POST") {
      calls += 1
      sent.push(body)

      if (body.sequence === 1 && calls === 1) {
        res.writeHead(500, { "content-type": "application/json" })
        res.end(JSON.stringify({ code: "DEVICE_ERROR", message: "temporary" }))
        return
      }

      res.writeHead(200, { "content-type": "application/json" })
      res.end(
        JSON.stringify({
          data: {
            duplicate: body.sequence === 1 && calls > 1,
            snapshotVersion: body.sequence,
            state: {},
            eventId: `event-${body.sequence}`,
          },
        }),
      )
      return
    }

    res.writeHead(404)
    res.end()
  })

  const client = new DeviceV1Client({
    baseUrl: mock.baseUrl,
    deviceId: "device-1",
    secret: "secret-1",
  })

  const buffer = createEventBuffer("boot-1")
  buffer.enqueue({ side: "a" })
  buffer.enqueue({ side: "b" })

  await flushEventBuffer(client, buffer)

  assert.deepEqual(
    sent.map((event) => event.sequence),
    [1, 1, 2],
  )
  assert.equal(buffer.size(), 0)
  assert.equal(isDuplicateScoreSuccess({ data: { duplicate: true } }), true)

  await mock.close()
})

test("heartbeat and command ack happy path", async () => {
  /** @type {string[]} */
  const paths = []

  const mock = await createMockServer((req, res, body) => {
    paths.push(`${req.method} ${req.url}`)

    if (req.url === "/api/device/v1/heartbeat" && req.method === "POST") {
      res.writeHead(200, { "content-type": "application/json" })
      res.end(
        JSON.stringify({
          data: {
            health: "online",
            lastHeartbeatAt: new Date().toISOString(),
            sampled: true,
            pendingCommandCount: 1,
          },
        }),
      )
      return
    }

    if (req.url === "/api/device/v1/commands" && req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json" })
      res.end(
        JSON.stringify({
          data: {
            commands: [
              {
                id: "cmd-1",
                kind: "apply_config",
                payload: {},
                expiresAt: new Date().toISOString(),
                correlationId: "corr-1",
                attemptCount: 1,
              },
            ],
          },
        }),
      )
      return
    }

    if (req.url === "/api/device/v1/commands/cmd-1/ack" && req.method === "POST") {
      assert.equal(body.idempotencyKey, "ack:cmd-1:1")
      res.writeHead(200, { "content-type": "application/json" })
      res.end(
        JSON.stringify({
          data: {
            command: {
              id: "cmd-1",
              status: "acknowledged",
              acknowledgedAt: new Date().toISOString(),
            },
          },
        }),
      )
      return
    }

    res.writeHead(404)
    res.end()
  })

  const client = new DeviceV1Client({
    baseUrl: mock.baseUrl,
    deviceId: "device-1",
    secret: "secret-1",
  })

  await client.heartbeat({
    bootId: "boot-1",
    firmwareVersion: "simulator-v1.0.0",
    uptimeMs: 1000,
    appliedConfigVersion: 3,
  })

  const commands = await client.listCommands()
  const command = commands.data.commands[0]
  await client.acknowledgeCommand(command.id, {
    idempotencyKey: `ack:${command.id}:${command.attemptCount}`,
    success: true,
    result: { appliedConfigVersion: 3 },
  })

  assert.deepEqual(paths, [
    "POST /api/device/v1/heartbeat",
    "GET /api/device/v1/commands",
    "POST /api/device/v1/commands/cmd-1/ack",
  ])

  await mock.close()
})

test("sequence gap errors are not retryable", () => {
  assert.equal(
    isRetryableDeviceError({ code: "SEQUENCE_GAP", status: 400 }),
    false,
  )
  assert.equal(isRetryableDeviceError({ code: "NETWORK_ERROR", status: 0 }), true)
})

test("inactive session errors do not dequeue earlier buffered events", async () => {
  /** @type {number[]} */
  const sentSequences = []

  const mock = await createMockServer((req, res, body) => {
    if (req.url === "/api/device/v1/events" && req.method === "POST") {
      sentSequences.push(body.sequence)

      if (body.sequence === 2) {
        res.writeHead(400, { "content-type": "application/json" })
        res.end(
          JSON.stringify({
            code: "SESSION_INACTIVE",
            message: "No active session.",
          }),
        )
        return
      }

      res.writeHead(200, { "content-type": "application/json" })
      res.end(
        JSON.stringify({
          data: {
            duplicate: false,
            snapshotVersion: body.sequence,
            state: {},
            eventId: `event-${body.sequence}`,
          },
        }),
      )
      return
    }

    res.writeHead(404)
    res.end()
  })

  const client = new DeviceV1Client({
    baseUrl: mock.baseUrl,
    deviceId: "device-1",
    secret: "secret-1",
  })

  const buffer = createEventBuffer("boot-1")
  buffer.enqueue({ side: "a" })
  buffer.enqueue({ side: "b" })

  await assert.rejects(() => flushEventBuffer(client, buffer), /No active session/)
  assert.deepEqual(sentSequences, [1, 2])
  assert.equal(buffer.peek()?.sequence, 2)

  await mock.close()
})

test("device v1 fixtures and simulator entrypoint exist", () => {
  const fixture = readFileSync(
    join(protocolRoot, "fixtures", "device-v1.json"),
    "utf8",
  )
  const cli = readFileSync(join(protocolRoot, "..", "simulator", "cli.mjs"), "utf8")

  assert.match(fixture, /"version": "device-v1"/)
  assert.match(fixture, /\/api\/device\/v1\/events/)
  assert.match(cli, /flushEventBuffer/)
  assert.match(cli, /createDebouncer/)
})

test("live simulator journey against PlayTT when configured", async (t) => {
  const baseUrl = process.env.PLAYTT_BASE_URL?.trim()
  const enrollmentCode = process.env.PLAYTT_ENROLLMENT_CODE?.trim()

  if (!baseUrl || !enrollmentCode) {
    t.skip("PLAYTT_BASE_URL and PLAYTT_ENROLLMENT_CODE are not configured")
    return
  }

  const client = new DeviceV1Client({ baseUrl })
  const provisioned = await client.provision({
    enrollmentCode,
    hardwareUid: `sim-live-${Date.now()}`,
    firmwareVersion: "simulator-v1.0.0",
  })

  client.setCredentials(provisioned)
  await client.heartbeat({
    bootId: `boot-${Date.now()}`,
    firmwareVersion: "simulator-v1.0.0",
    uptimeMs: 1,
  })
})
