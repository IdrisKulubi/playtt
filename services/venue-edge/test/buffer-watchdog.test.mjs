import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import {
  BUFFER_RESTART_MAX_MS,
  BUFFER_RESTART_MIN_MS,
  BUFFER_STALL_MS,
  SourceSupervisorRegistry,
} from "../src/buffers/registry.ts"
import { RTSP_SOCKET_TIMEOUT_US } from "../src/buffers/rolling-buffer.ts"
import { loadEnv } from "../src/config/env.ts"

/** Stands in for an ffmpeg buffer: running/progress are set by the test. */
function fakeSupervisor({ running = true, lastProgressAt = Date.now() } = {}) {
  return {
    running,
    lastProgressAt,
    stopped: false,
    isRunning() {
      return this.running
    },
    isStalled(now, stallMs) {
      return this.running && now - this.lastProgressAt > stallMs
    },
    getLastProgressAt() {
      return this.lastProgressAt
    },
    async stop() {
      this.stopped = true
      this.running = false
    },
  }
}

const registries = []

function registryWith(entries) {
  const registry = new SourceSupervisorRegistry(loadEnv({ mode: "simulate" }), {}, {})
  for (const [id, supervisor] of entries) registry.supervisors.set(id, supervisor)
  registries.push(registry)
  return registry
}

// The restart pass may start simulated buffers; stop them so the run exits.
test.after(async () => {
  for (const registry of registries) await registry.stopAll()
})

const NO_CONFIG = { edgeConfig: null, edgeConfigV2: null }

test("ffmpeg gives up on a silent recorder instead of waiting forever", () => {
  assert.equal(RTSP_SOCKET_TIMEOUT_US, 15_000_000)
  const source = readFileSync(join(import.meta.dirname, "..", "src", "buffers", "rolling-buffer.ts"), "utf8")
  assert.match(source, /"-timeout",\s+String\(RTSP_SOCKET_TIMEOUT_US\),\s+"-i"/)
})

test("a buffer with no new video for 45 s is stopped and queued for restart", async () => {
  const now = Date.now()
  const stuck = fakeSupervisor({ lastProgressAt: now - BUFFER_STALL_MS - 1_000 })
  const registry = registryWith([["cam-4", stuck]])

  await registry.superviseOnce(NO_CONFIG, now)

  assert.equal(stuck.stopped, true)
  assert.equal(registry.supervisors.has("cam-4"), false)
  assert.deepEqual(registry.restartBackoff.get("cam-4"), { notBefore: now + BUFFER_RESTART_MIN_MS, delayMs: BUFFER_RESTART_MIN_MS })
})

test("an exited ffmpeg is restarted with growing back-off, capped at 2 minutes", async () => {
  const exited = fakeSupervisor({ running: false })
  const registry = registryWith([["cam-3", exited]])
  let now = Date.now()
  const delays = []

  for (let pass = 0; pass < 6; pass += 1) {
    await registry.superviseOnce(NO_CONFIG, now)
    delays.push(registry.restartBackoff.get("cam-3").delayMs)
    now = registry.restartBackoff.get("cam-3").notBefore
  }

  assert.deepEqual(delays, [10_000, 20_000, 40_000, 80_000, BUFFER_RESTART_MAX_MS, BUFFER_RESTART_MAX_MS])
})

test("a buffer saving video is left alone and its back-off is cleared", async () => {
  const now = Date.now()
  const healthy = fakeSupervisor({ lastProgressAt: now - 2_000 })
  const registry = registryWith([["cam-1", healthy]])
  registry.restartBackoff.set("cam-1", { notBefore: now - 1, delayMs: 40_000 })

  await registry.superviseOnce(NO_CONFIG, now)

  assert.equal(healthy.stopped, false)
  assert.equal(registry.restartBackoff.has("cam-1"), false)
})

test("the watchdog is started at boot and stopped with the buffers", () => {
  const index = readFileSync(join(import.meta.dirname, "..", "src", "index.ts"), "utf8")
  assert.match(index, /bufferRegistry\.startWatchdog\(/)
  const registry = readFileSync(join(import.meta.dirname, "..", "src", "buffers", "registry.ts"), "utf8")
  assert.match(registry, /async stopAll\(\): Promise<void> \{\s+if \(this\.watchdogTimer\) \{\s+clearInterval/)
})
