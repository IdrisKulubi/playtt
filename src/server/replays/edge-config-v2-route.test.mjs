import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

const repoRoot = join(import.meta.dirname, "..", "..", "..")

test("edge config v2 route is device-authenticated and reads published config", () => {
  const route = readFileSync(
    join(repoRoot, "src", "app", "api", "edge", "v2", "config", "route.ts"),
    "utf8",
  )
  const repository = readFileSync(
    join(repoRoot, "src", "server", "replays", "edge-config-v2-repository.ts"),
    "utf8",
  )

  assert.match(route, /requireDeviceRequest/)
  assert.match(route, /getPublishedEdgeConfigV2ForDevice/)
  assert.match(route, /if-none-match/)
  assert.match(route, /status: 304/)
  assert.match(route, /etag/)
  assert.match(repository, /deviceType !== "venue_edge"/)
  assert.match(repository, /venueEdgeInstallations/)
  assert.match(repository, /venueEdgeConfigRevisions/)
  assert.match(repository, /status, "published"/)
  assert.match(repository, /assertEdgeConfigV2/)
})

test("edge config v2 endpoint cannot fall back to singular v1 assignment config", () => {
  const repository = readFileSync(
    join(repoRoot, "src", "server", "replays", "edge-config-v2-repository.ts"),
    "utf8",
  )

  assert.doesNotMatch(repository, /deviceAssignments/)
  assert.doesNotMatch(repository, /filterEdgeConfigSecrets/)
  assert.match(repository, /CONFIG_NOT_READY/)
  assert.match(repository, /CONFIG_INVALID/)
})
