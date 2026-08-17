import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { reconcileScoreHint } from "./reconcile.mjs"

const realtimeRoot = import.meta.dirname
const repoRoot = join(realtimeRoot, "..", "..", "..")
const workersRoot = join(repoRoot, "src", "server", "workers")

test("reconcile applies sequential hints and refetches on gaps", () => {
  assert.equal(reconcileScoreHint(3, 3), "noop")
  assert.equal(reconcileScoreHint(3, 4), "apply")
  assert.equal(reconcileScoreHint(3, 5), "refetch")
  assert.equal(reconcileScoreHint(null, 1), "refetch")
  assert.equal(reconcileScoreHint(2, null), "ignore")
})

test("memory adapter isolates channels and supports unsubscribe", async () => {
  const { createMemoryRealtimeAdapter } = await import("./memory-adapter.ts")
  const adapter = createMemoryRealtimeAdapter()
  const tenantId = "tenant-a"
  const resourceA = "resource-a"
  const resourceB = "resource-b"
  const channelA = `tenant:${tenantId}:resource:${resourceA}`
  const channelB = `tenant:${tenantId}:resource:${resourceB}`

  const seenA = []
  const seenB = []

  const subA = adapter.subscribe(channelA, (hint) => {
    seenA.push(hint.snapshotVersion)
  })
  adapter.subscribe(channelB, (hint) => {
    seenB.push(hint.snapshotVersion)
  })

  await adapter.publish(channelA, {
    playSessionId: "session-1",
    snapshotVersion: 1,
    eventId: "event-1",
  })
  await adapter.publish(channelB, {
    playSessionId: "session-2",
    snapshotVersion: 2,
    eventId: "event-2",
  })

  assert.deepEqual(seenA, [1])
  assert.deepEqual(seenB, [2])

  subA.unsubscribe()

  await adapter.publish(channelA, {
    playSessionId: "session-1",
    snapshotVersion: 2,
    eventId: "event-2",
  })

  assert.deepEqual(seenA, [1])
})

test("score updated consumer swallows adapter failures", () => {
  const source = readFileSync(
    join(realtimeRoot, "score-updated-consumer.ts"),
    "utf8",
  )

  assert.match(source, /catch \(error\)/)
  assert.match(source, /score\.updated\.v1 fan-out failed/)
  assert.doesNotMatch(source.slice(source.indexOf("export async function consumeScoreUpdated")), /throw error/)
})

test("score updated consumer is registered in durable work", () => {
  const source = readFileSync(join(workersRoot, "run-durable-work.ts"), "utf8")

  assert.match(source, /createScoreUpdatedConsumers/)
  assert.match(source, /\.\.\.createScoreUpdatedConsumers\(\)/)
})

test("events registry defines score.updated.v1", () => {
  const source = readFileSync(join(workersRoot, "events.mjs"), "utf8")
  assert.match(source, /SCORE_UPDATED_V1: "score\.updated\.v1"/)
})
