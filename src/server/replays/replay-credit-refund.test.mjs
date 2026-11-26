import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

const repoRoot = join(import.meta.dirname, "..", "..", "..")
const read = (path) => readFileSync(join(repoRoot, path), "utf8")

test("every failed capture refunds its clip credit, once", () => {
  const refund = read("src/server/replays/replay-credit-refund.ts")
  for (const status of ["edge_offline", "buffer_missing", "extraction_failed", "upload_failed", "failed", "expired"]) {
    assert.match(refund, new RegExp(`"${status}"`))
  }
  // Only replays that were charged, and never twice.
  assert.match(refund, /row\.reason === "replay_capture"/)
  assert.match(refund, /ledger\.some\(\(row\) => row\.reason === "refund"\)/)
  assert.match(refund, /delta: 1,\s+reason: "refund"/)
})

test("the refund runs inside the status transition every failure goes through", () => {
  const repository = read("src/server/replays/replay-requests-repository.ts")
  const transition = repository.slice(repository.indexOf("export async function transitionReplayRequestStatus"))
  assert.match(transition, /REPLAY_FAILURE_STATUSES\.has\(input\.toStatus\)[\s\S]*refundReplayCaptureCredit\(executor/)
})

test("the venue PC panel separates 'online' from 'recording'", () => {
  const panel = read("src/components/nvr/nvr-fleet-panel.tsx")
  assert.match(panel, /label: "Venue PC"/)
  assert.match(panel, /label: "Recording"/)
  assert.match(panel, /Online, but not recording/)
})
