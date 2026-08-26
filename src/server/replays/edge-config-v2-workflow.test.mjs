import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import {
  canonicalizeEdgeConfigSnapshot,
  checksumEdgeConfigSnapshot,
  cloneCanonicalEdgeConfigSnapshot,
} from "./edge-config-v2-checksum.ts"
import { assertSafeEdgeConfigV2ErrorDetails } from "./edge-config-v2-diagnostics.ts"
import {
  compareSemver,
  validateEdgeAgentVersion,
} from "./edge-agent-version.ts"

const repoRoot = join(import.meta.dirname, "..", "..", "..")

function source(path) {
  return readFileSync(join(repoRoot, path), "utf8")
}

test("config checksum is canonical across object insertion order", () => {
  const left = {
    resources: [{ enabled: true, resourceId: "resource-1" }],
    policy: { priority: 1, modes: ["edge_buffer", "nvr_playback"] },
  }
  const right = {
    policy: { modes: ["edge_buffer", "nvr_playback"], priority: 1 },
    resources: [{ resourceId: "resource-1", enabled: true }],
  }

  assert.equal(
    canonicalizeEdgeConfigSnapshot(left),
    canonicalizeEdgeConfigSnapshot(right)
  )
  assert.equal(
    checksumEdgeConfigSnapshot(left),
    checksumEdgeConfigSnapshot(right)
  )
  assert.match(checksumEdgeConfigSnapshot(left), /^[0-9a-f]{64}$/)
})

test("canonical clone is detached and has stable key order", () => {
  const original = { z: 1, nested: { b: 2, a: 1 }, a: 2 }
  const cloned = cloneCanonicalEdgeConfigSnapshot(original)
  cloned.nested.a = 99

  assert.equal(original.nested.a, 1)
  assert.equal(
    canonicalizeEdgeConfigSnapshot(original),
    '{"a":2,"nested":{"a":1,"b":2},"z":1}'
  )
})

test("canonical ordering does not depend on localeCompare", () => {
  const checksumSource = source("src/server/replays/edge-config-v2-checksum.ts")
  assert.doesNotMatch(checksumSource, /localeCompare/)
})

test("application diagnostics reject secrets, credentialized URLs, and oversized data", () => {
  assert.throws(
    () => assertSafeEdgeConfigV2ErrorDetails({ password: "do-not-store" }),
    /secret-bearing field/
  )
  assert.throws(
    () =>
      assertSafeEdgeConfigV2ErrorDetails({
        message: "FFmpeg failed for rtsp://user:pass@camera.local/live.",
      }),
    /credentialized URL/
  )
  assert.throws(
    () => assertSafeEdgeConfigV2ErrorDetails({ message: "x".repeat(17_000) }),
    /16 KiB/
  )
  assert.doesNotThrow(() =>
    assertSafeEdgeConfigV2ErrorDetails({
      code: "NVR_AUTH_FAILED",
      recorderId: "recorder-id",
    })
  )
})

test("Config v2 rejects missing and outdated edge agent versions actionably", () => {
  assert.equal(compareSemver("0.2.0", "0.2.0"), 0)
  assert.equal(compareSemver("0.2.1", "0.2.0"), 1)
  assert.equal(compareSemver("0.2.0-beta.1", "0.2.0"), -1)
  assert.deepEqual(validateEdgeAgentVersion(null, "0.2.0"), {
    success: false,
    code: "AGENT_VERSION_REQUIRED",
    message:
      "VenueEdge Agent version is required and must be valid. Upgrade to 0.2.0 or newer and retry.",
  })
  assert.equal(validateEdgeAgentVersion("0.1.9", "0.2.0").success, false)
  assert.deepEqual(validateEdgeAgentVersion("0.2.0", "0.2.0"), {
    success: true,
    version: "0.2.0",
  })
})

test("publication locks venue, validates final contract, and supersedes atomically", () => {
  const publication = source("src/server/replays/edge-config-v2-publication.ts")

  assert.match(publication, /db\.transaction/)
  assert.match(publication, /locations\.tenantId/)
  assert.match(publication, /locations\.id/)
  assert.match(publication, /\.for\("update"\)/)
  assert.match(publication, /latestRevision\?\.version \?\? 0/)
  assert.match(publication, /checksumEdgeConfigSnapshot/)
  assert.match(publication, /assertEdgeConfigV2/)
  assert.match(publication, /status: "superseded"/)
  assert.match(publication, /status: "published"/)
  assert.ok(
    publication.indexOf("assertEdgeConfigV2") <
      publication.indexOf('status: "superseded"')
  )
})

test("application acknowledgement is scoped and terminally idempotent", () => {
  const application = source(
    "src/server/replays/edge-config-v2-applications.ts"
  )

  assert.match(application, /deviceType !== "venue_edge"/)
  assert.match(application, /venueEdgeInstallations\.tenantId/)
  assert.match(application, /venueEdgeInstallations\.locationId/)
  assert.match(application, /venueEdgeInstallations\.edgeDeviceId/)
  assert.match(application, /venueEdgeInstallations\.installationUid/)
  assert.match(application, /venueEdgeConfigRevisions\.tenantId/)
  assert.match(application, /venueEdgeConfigRevisions\.locationId/)
  assert.match(application, /venueEdgeConfigApplications\.configRevisionId/)
  assert.match(application, /existing\.status !== "pending"/)
  assert.match(application, /idempotent: true/)
  assert.match(application, /onConflictDoNothing/)
  assert.match(application, /application\.status === "applied"/)
  assert.match(application, /lastConfigAppliedAt/)
  assert.match(application, /assertSafeEdgeConfigV2ErrorDetails/)
})

test("v2 application route requires device auth and only accepts applied/rejected", () => {
  const route = source("src/app/api/edge/v2/config/applications/route.ts")

  assert.match(route, /requireDeviceRequest/)
  assert.match(route, /z\.enum\(\["applied", "rejected"\]\)/)
  assert.match(route, /acknowledgeEdgeConfigV2Application/)
  assert.match(route, /mapDeviceError/)
  assert.match(route, /x-playtt-edge-agent-version/)
})

test("v2 config ETag includes the revision version", () => {
  const route = source("src/app/api/edge/v2/config/route.ts")
  assert.match(route, /config\.configRevision\.version/)
  assert.match(route, /if-none-match/)
  assert.match(route, /x-playtt-edge-agent-version/)
  assert.match(route, /validateEdgeAgentVersion/)
})
