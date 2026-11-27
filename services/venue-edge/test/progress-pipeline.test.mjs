import assert from "node:assert/strict"
import test from "node:test"

import { ProgressPipeline } from "../src/replay/orchestrator.ts"

const tick = () => new Promise((resolve) => setTimeout(resolve, 5))

test("progress reports go out in order without blocking the caller", async () => {
  const sent = []
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  const pipeline = new ProgressPipeline(async (status) => {
    if (status === "edge_acknowledged") await gate
    sent.push(status)
  }, 1)

  pipeline.enqueue("edge_acknowledged")
  pipeline.enqueue("capturing")
  pipeline.enqueue("extracting")
  // enqueue returned immediately even though the first send is still pending.
  assert.deepEqual(sent, [])

  release()
  await pipeline.drain()
  assert.deepEqual(sent, ["edge_acknowledged", "capturing", "extracting"])
})

test("a transient failure is retried once in the background", async () => {
  const sent = []
  let failures = 1
  const pipeline = new ProgressPipeline(async (status) => {
    if (failures > 0) {
      failures -= 1
      throw new Error("fetch failed")
    }
    sent.push(status)
  }, 1)

  pipeline.enqueue("edge_acknowledged")
  pipeline.enqueue("capturing")
  await pipeline.drain()
  assert.deepEqual(sent, ["edge_acknowledged", "capturing"])
})

test("drain retries what is left after a background failure, then throws if still down", async () => {
  const sent = []
  let down = true
  const pipeline = new ProgressPipeline(async (status) => {
    if (down) throw new Error("cloud unreachable")
    sent.push(status)
  }, 1)

  pipeline.enqueue("edge_acknowledged")
  pipeline.enqueue("capturing")
  await tick()
  await tick()
  // Order is kept: nothing after the failed status was sent.
  assert.deepEqual(sent, [])

  await assert.rejects(pipeline.drain(), /cloud unreachable/)

  down = false
  await pipeline.drain()
  assert.deepEqual(sent, ["edge_acknowledged", "capturing"])
})

test("settle never throws, so the failure path can always report", async () => {
  const pipeline = new ProgressPipeline(async () => {
    throw new Error("cloud unreachable")
  }, 1)
  pipeline.enqueue("edge_acknowledged")
  await pipeline.settle()
})
