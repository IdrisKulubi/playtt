import assert from "node:assert/strict"
import test from "node:test"

import { compareSemver } from "./edge-agent-version.ts"
import {
  isReleaseEligibleForInstallation,
  releaseMatchesInstallationCohort,
  rolloutBucketForInstallation,
} from "./venue-edge-rollout-policy.ts"

const installation = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  locationId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  updateChannel: "pilot",
}

function release(overrides = {}) {
  return {
    version: "1.1.0",
    rolloutCohort: null,
    rolloutPercentage: 100,
    canaryInstallationIds: [],
    ...overrides,
  }
}

function pickHighestEligible(
  releases,
  state = installation,
) {
  return releases
    .filter((candidate) => isReleaseEligibleForInstallation(state, candidate))
    .sort((left, right) => {
      const comparison = compareSemver(left.version, right.version)
      return comparison === null ? 0 : -comparison
    })[0] ?? null
}

test("canary installations receive canary-only releases before percentage gates", () => {
  const canaryRelease = release({
    version: "1.2.0",
    rolloutPercentage: 0,
    canaryInstallationIds: [installation.id],
  })
  const blockedRelease = release({
    version: "1.3.0",
    rolloutPercentage: 0,
    canaryInstallationIds: ["other-installation"],
  })

  assert.equal(
    pickHighestEligible([blockedRelease, canaryRelease])?.version,
    "1.2.0",
  )
})

test("percentage rollout excludes installations outside the bucket", () => {
  const bucket = rolloutBucketForInstallation(installation.id)
  const includedPercentage =
    bucket < 99 ? bucket + 1 : bucket === 0 ? 1 : bucket
  const excludedPercentage = bucket === 0 ? 0 : bucket

  const includedRelease = release({
    version: "1.2.0",
    rolloutPercentage: includedPercentage,
  })
  const excludedRelease = release({
    version: "1.3.0",
    rolloutPercentage: excludedPercentage,
  })

  const picked = pickHighestEligible([excludedRelease, includedRelease])

  if (bucket < 99) {
    assert.equal(picked?.version, "1.2.0")
  } else {
    assert.equal(picked, null)
  }
})

test("cohort releases match channel, explicit tag, or venue location", () => {
  assert.equal(
    releaseMatchesInstallationCohort(
      installation,
      release({ rolloutCohort: "pilot" }),
    ),
    true,
  )
  assert.equal(
    releaseMatchesInstallationCohort(
      installation,
      release({ rolloutCohort: installation.locationId }),
    ),
    true,
  )
  assert.equal(
    releaseMatchesInstallationCohort(
      { ...installation, rolloutCohortTag: "hurlingham-pilot" },
      release({ rolloutCohort: "hurlingham-pilot" }),
    ),
    true,
  )
  assert.equal(
    releaseMatchesInstallationCohort(
      installation,
      release({ rolloutCohort: "stable-only" }),
    ),
    false,
  )
})

test("cohort mismatch blocks rollout even at 100 percent", () => {
  const mismatched = release({
    version: "1.4.0",
    rolloutCohort: "stable-only",
    rolloutPercentage: 100,
  })

  assert.equal(pickHighestEligible([mismatched]), null)
})
