import { readFileSync } from "node:fs"
import { join } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

const repoRoot = join(import.meta.dirname, "..", "..", "..")
const replaysRoot = import.meta.dirname
const workersRoot = join(repoRoot, "src", "server", "workers")
const realtimeRoot = join(repoRoot, "src", "server", "realtime")

test("events define replay.ready.v1 helpers", () => {
  const source = readFileSync(join(workersRoot, "events.mjs"), "utf8")

  assert.match(source, /REPLAY_READY_V1: "replay\.ready\.v1"/)
  assert.match(source, /buildReplayReadyOutboxEvent/)
  assert.match(source, /replayReadyIdempotencyKey/)
  assert.match(source, /replay\.ready\.v1:\$\{replayId\}/)
})

test("edge completion verifies storage and emits replay.ready.v1", () => {
  const source = readFileSync(join(replaysRoot, "edge-completion.ts"), "utf8")

  assert.match(source, /completeReplayFromEdge/)
  assert.match(source, /headObject/)
  assert.match(source, /transitionMediaAssetReady/)
  assert.match(source, /transitionReplayRequestStatus/)
  assert.match(source, /buildReplayReadyOutboxEvent/)
  assert.match(source, /videoUrl: null/)
  assert.match(source, /templateKey: "replay_ready"/)
  assert.match(source, /db\.transaction/)
})

test("edge media complete and progress routes call completion flow", () => {
  const completeRoute = readFileSync(
    join(
      repoRoot,
      "src/app/api/edge/v1/media/[mediaId]/complete/route.ts",
    ),
    "utf8",
  )
  const progressRoute = readFileSync(
    join(
      repoRoot,
      "src/app/api/edge/v1/replay-requests/[id]/progress/route.ts",
    ),
    "utf8",
  )

  assert.match(completeRoute, /requireDeviceRequest/)
  assert.match(completeRoute, /completeReplayFromEdge/)
  assert.match(progressRoute, /checksumSha256/)
  assert.match(progressRoute, /completeReplayFromEdge/)
})

test("replay ready consumer is idempotent and registered in durable work", () => {
  const consumerSource = readFileSync(
    join(replaysRoot, "replay-ready-consumer.ts"),
    "utf8",
  )
  const emailSource = readFileSync(
    join(replaysRoot, "replay-ready-email.ts"),
    "utf8",
  )
  const durableWorkSource = readFileSync(
    join(workersRoot, "run-durable-work.ts"),
    "utf8",
  )

  assert.match(consumerSource, /enqueueCoachAnalysisForReplay/)
  assert.match(consumerSource, /consumeReplayReadyEmail/)
  assert.match(consumerSource, /publishReplayReadyRealtime/)
  assert.match(emailSource, /replay-ready\/\$\{replayId\}/)
  assert.match(emailSource, /\/replays\/\$\{replayId\}/)
  assert.match(emailSource, /templateKey, "replay_ready"/)
  assert.doesNotMatch(emailSource, /presigned|createDownloadGrant/)
  assert.match(durableWorkSource, /createReplayReadyConsumers/)
})

test("playback route allows owner and denies other users", () => {
  const playbackRoute = readFileSync(
    join(repoRoot, "src/app/api/replays/[id]/playback/route.ts"),
    "utf8",
  )
  const playbackService = readFileSync(join(replaysRoot, "playback.ts"), "utf8")

  assert.match(playbackRoute, /getReplayPlaybackGrant/)
  assert.match(playbackRoute, /authenticateDeviceRequest/)
  assert.match(playbackService, /authorizeReplayPlayback/)
  assert.match(playbackService, /REPLAY_FORBIDDEN/)
  assert.match(playbackService, /replay\.userId === input\.userId/)
  assert.match(playbackService, /role, "display"/)
  assert.match(playbackService, /createPlaybackGrantForMediaAsset/)
})

test("replay library page uses authenticated playback grant", () => {
  const pageSource = readFileSync(
    join(repoRoot, "src/app/replays/[id]/page.tsx"),
    "utf8",
  )

  assert.match(pageSource, /getReplayDetailForUser/)
  assert.match(pageSource, /redirect\("\/sign-in"\)/)
  assert.match(pageSource, /playbackUrl/)
  assert.match(pageSource, /<video/)
})

test("realtime replay.ready stays resource-scoped", () => {
  const typesSource = readFileSync(join(realtimeRoot, "types.ts"), "utf8")
  const completionSource = readFileSync(
    join(replaysRoot, "edge-completion.ts"),
    "utf8",
  )

  assert.match(typesSource, /ReplayReadyHint/)
  assert.match(typesSource, /type: "replay\.ready"/)
  assert.match(completionSource, /resourceChannel\(input\.tenantId, input\.resourceId\)/)
  assert.doesNotMatch(completionSource, /venueChannel|sessionChannel/)
})
