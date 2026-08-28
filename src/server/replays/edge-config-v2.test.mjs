import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { PLAYTT_TENANT_ID } from "../tenancy/constants.ts"
import {
  assertEdgeConfigV2,
  validateEdgeConfigV2,
} from "./edge-config-v2.ts"

const fixtureDirectory = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "services",
  "venue-edge",
  "fixtures",
)

function readFixture(filename) {
  return JSON.parse(readFileSync(join(fixtureDirectory, filename), "utf8"))
}

const edgeConfigV2Fixtures = {
  oneNvr: readFixture("edge-v2-one-nvr.json"),
  threeNvrMultiCamera: readFixture("edge-v2-three-nvr.json"),
  disabledSources: readFixture("edge-v2-disabled-source.json"),
  manualOverride: readFixture("edge-v2-manual-override.json"),
  crossNvrFailover: readFixture("edge-v2-cross-nvr-failover.json"),
}

function clone(value) {
  return structuredClone(value)
}

function issueCodes(result) {
  return result.success ? [] : result.issues.map((issue) => issue.code)
}

test("deterministic v2 fixtures validate across supported topologies", () => {
  for (const [name, fixture] of Object.entries(edgeConfigV2Fixtures)) {
    const result = validateEdgeConfigV2(fixture)
    assert.equal(
      result.success,
      true,
      `${name}: ${result.success ? "" : JSON.stringify(result.issues)}`,
    )
  }
})

test("three-NVR fixture maps multiple cameras and resources", () => {
  const fixture = assertEdgeConfigV2(
    edgeConfigV2Fixtures.threeNvrMultiCamera,
  )
  assert.equal(fixture.recorders.length, 3)
  assert.equal(fixture.sources.length, 5)
  assert.equal(fixture.resourcePolicies.length, 3)
})

test("disabled sources remain inventory but cannot be routed", () => {
  const fixture = assertEdgeConfigV2(edgeConfigV2Fixtures.disabledSources)
  const disabledSource = fixture.sources.find((source) => !source.enabled)
  assert.ok(disabledSource)
  assert.equal(
    fixture.resourcePolicies.some((policy) =>
      policy.candidates.some(
        (candidate) => candidate.sourceId === disabledSource.id,
      ),
    ),
    false,
  )

  const invalid = clone(fixture)
  invalid.resourcePolicies[0].candidates.push({
    sourceId: disabledSource.id,
    priority: 2,
    captureModes: ["nvr_playback"],
  })
  assert.ok(issueCodes(validateEdgeConfigV2(invalid)).includes("inactive_reference"))
})

test("manual override must select an enabled candidate for its resource", () => {
  const fixture = assertEdgeConfigV2(edgeConfigV2Fixtures.manualOverride)
  assert.equal(fixture.resourcePolicies[0].selectionMode, "manual")
  assert.equal(
    fixture.resourcePolicies[0].manualSourceId,
    fixture.resourcePolicies[0].candidates[1].sourceId,
  )

  const invalid = clone(fixture)
  invalid.resourcePolicies[0].manualSourceId =
    "80000000-0000-4000-8000-000000000099"
  assert.ok(issueCodes(validateEdgeConfigV2(invalid)).includes("policy_conflict"))
})

test("cross-NVR failover keeps deterministic source priority", () => {
  const fixture = assertEdgeConfigV2(edgeConfigV2Fixtures.crossNvrFailover)
  const policy = fixture.resourcePolicies[0]
  const sourceById = new Map(fixture.sources.map((source) => [source.id, source]))

  assert.deepEqual(
    policy.candidates.map((candidate) => candidate.priority),
    [1, 2],
  )
  assert.notEqual(
    sourceById.get(policy.candidates[0].sourceId).recorderId,
    sourceById.get(policy.candidates[1].sourceId).recorderId,
  )
})

test("rejects password, token, secretRef, and credentialized RTSP material", () => {
  for (const mutation of [
    (config) => {
      config.recorders[0].password = "not-allowed"
    },
    (config) => {
      config.installation.bootstrapToken = "not-allowed"
    },
    (config) => {
      config.recorders[0].secretRef = "not-allowed"
    },
    (config) => {
      config.recorders[0].connection.host =
        "rtsp://playtt:password@192.168.10.20/live/1"
    },
  ]) {
    const invalid = clone(edgeConfigV2Fixtures.oneNvr)
    mutation(invalid)
    assert.ok(
      issueCodes(validateEdgeConfigV2(invalid)).includes("secret_material"),
    )
  }
})

test("accepts Postgres uuid values including PlayTT sentinel tenant IDs", () => {
  const fixture = clone(edgeConfigV2Fixtures.oneNvr)
  const venueId = "11111111-1111-1111-1111-111111111111"
  const resourceId = fixture.resources[0].resourceId

  fixture.installation.tenantId = PLAYTT_TENANT_ID
  fixture.installation.venueId = venueId
  fixture.resources[0].tenantId = PLAYTT_TENANT_ID
  fixture.resources[0].venueId = venueId

  const result = validateEdgeConfigV2(fixture)
  assert.equal(
    result.success,
    true,
    result.success ? "" : JSON.stringify(result.issues),
  )
  assert.equal(assertEdgeConfigV2(fixture).resources[0].resourceId, resourceId)
})

test("allows opaque localConnectionKey references", () => {
  const fixture = clone(edgeConfigV2Fixtures.oneNvr)
  fixture.recorders[0].localConnectionKey = "windows-dpapi:nvr-main"
  assert.equal(validateEdgeConfigV2(fixture).success, true)
})

test("rejects duplicate source IDs and duplicate resource priorities", () => {
  const duplicateSource = clone(edgeConfigV2Fixtures.crossNvrFailover)
  duplicateSource.sources[1].id = duplicateSource.sources[0].id
  assert.ok(
    issueCodes(validateEdgeConfigV2(duplicateSource)).includes("duplicate_id"),
  )

  const duplicatePriority = clone(edgeConfigV2Fixtures.crossNvrFailover)
  duplicatePriority.resourcePolicies[0].candidates[1].priority = 1
  assert.ok(
    issueCodes(validateEdgeConfigV2(duplicatePriority)).includes(
      "duplicate_priority",
    ),
  )
})

test("rejects cross-venue resources and policies for unknown resources", () => {
  const wrongVenue = clone(edgeConfigV2Fixtures.oneNvr)
  wrongVenue.resources[0].venueId =
    "99999999-9999-4999-8999-999999999999"
  assert.ok(
    issueCodes(validateEdgeConfigV2(wrongVenue)).includes(
      "membership_mismatch",
    ),
  )

  const unknownResource = clone(edgeConfigV2Fixtures.oneNvr)
  unknownResource.resourcePolicies[0].resourceId =
    "99999999-9999-4999-8999-999999999998"
  assert.ok(
    issueCodes(validateEdgeConfigV2(unknownResource)).includes(
      "membership_mismatch",
    ),
  )
})

test("every enabled resource requires exactly one priority 1 route", () => {
  const missingPrimary = clone(edgeConfigV2Fixtures.crossNvrFailover)
  missingPrimary.resourcePolicies[0].candidates[0].priority = 3
  assert.ok(
    issueCodes(validateEdgeConfigV2(missingPrimary)).includes("policy_conflict"),
  )

  const missingPolicy = clone(edgeConfigV2Fixtures.oneNvr)
  missingPolicy.resourcePolicies = []
  assert.ok(
    issueCodes(validateEdgeConfigV2(missingPolicy)).includes("policy_conflict"),
  )
})
