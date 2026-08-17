import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { reconcileScoreHint } from "./reconcile.mjs"

const realtimeRoot = import.meta.dirname
const repoRoot = join(realtimeRoot, "..", "..", "..")
const appRoot = join(repoRoot, "src", "app")

test("display snapshot route resolves resource-scoped active sessions", () => {
  const source = readFileSync(join(realtimeRoot, "display-query.ts"), "utf8")

  assert.match(source, /eq\(playSessions\.status, "active"\)/)
  assert.match(source, /status: "idle"/)
  assert.match(source, /status: "active"/)
  assert.match(source, /eq\(playSessions\.resourceId, resource\.id\)/)
})

test("display snapshot and stream routes exist", () => {
  const snapshotRoute = readFileSync(
    join(
      appRoot,
      "api",
      "display",
      "v1",
      "resources",
      "[resourceId]",
      "snapshot",
      "route.ts",
    ),
    "utf8",
  )
  const streamRoute = readFileSync(
    join(
      appRoot,
      "api",
      "display",
      "v1",
      "resources",
      "[resourceId]",
      "stream",
      "route.ts",
    ),
    "utf8",
  )

  assert.match(snapshotRoute, /getDisplaySnapshotForResource/)
  assert.match(streamRoute, /text\/event-stream/)
  assert.match(streamRoute, /adapter\.subscribe/)
})

test("device ingest drains durable work only for new events", () => {
  const source = readFileSync(
    join(appRoot, "api", "device", "v1", "events", "route.ts"),
    "utf8",
  )

  assert.match(source, /if \(!result\.duplicate\)/)
  assert.match(source, /runDurableWorkCycle\(\)/)
})

test("kiosk and tv pages load live score display", () => {
  const scoreboard = readFileSync(
    join(appRoot, "pod", "scoreboard", "page.tsx"),
    "utf8",
  )
  const tv = readFileSync(join(appRoot, "pod", "tv", "page.tsx"), "utf8")

  assert.match(scoreboard, /variant="kiosk"/)
  assert.match(tv, /variant="tv"/)
  assert.match(scoreboard, /resourceId/)
})

test("live score hook refetches on version gaps", () => {
  const source = readFileSync(
    join(repoRoot, "src", "components", "display", "use-live-score.ts"),
    "utf8",
  )

  assert.match(source, /EventSource/)
  assert.match(source, /fetchSnapshot/)
  assert.match(source, /POLL_MS/)
  assert.equal(reconcileScoreHint(4, 6), "refetch")
})

test("display fan-out stays isolated per resource when database is available", async (t) => {
  if (!process.env.POSTGRES_URL?.trim()) {
    t.skip("POSTGRES_URL is not configured")
    return
  }

  const { createMemoryRealtimeAdapter } = await import("./memory-adapter.ts")
  const adapter = createMemoryRealtimeAdapter()
  const tenantId = "00000000-0000-4000-8000-000000000001"
  const resourceA = "00000000-0000-4000-8000-0000000000a1"
  const resourceB = "00000000-0000-4000-8000-0000000000b1"

  const seenA = []
  const seenB = []

  adapter.subscribe(`tenant:${tenantId}:resource:${resourceA}`, (hint) => {
    seenA.push(hint.snapshotVersion)
  })
  adapter.subscribe(`tenant:${tenantId}:resource:${resourceB}`, (hint) => {
    seenB.push(hint.snapshotVersion)
  })

  await adapter.publish(`tenant:${tenantId}:resource:${resourceA}`, {
    playSessionId: "session-a",
    snapshotVersion: 7,
    eventId: "event-a",
  })

  assert.deepEqual(seenA, [7])
  assert.deepEqual(seenB, [])
})
