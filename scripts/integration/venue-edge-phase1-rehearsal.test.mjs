import assert from "node:assert/strict"
import { after, before, test } from "node:test"

import {
  planLegacyVenueEdgeTopology,
  summarizeLegacyVenueEdgePlan,
} from "../lib/venue-edge-topology-backfill.mjs"
import { applyLegacyVenueEdgeTopologyPlan } from "../lib/venue-edge-topology-apply.mjs"
import {
  assertNoCredentialLeakInTopology,
  assertVenueEdgeFoundationTables,
  credentialFreeRehearsalReport,
  loadLegacyRowsForRehearsal,
  REHEARSAL_ASSIGNMENT_ID,
  REHEARSAL_LOCATION_ID,
  REHEARSAL_TENANT_ID,
  seedSyntheticLegacyVenueEdgeAssignment,
  setVenueEdgeConfigV2Flag,
} from "../lib/venue-edge-rehearsal-fixture.mjs"
import {
  createDisposableMigrationHarness,
  hasIntegrationDatabase,
} from "../lib/disposable-migration-harness.mjs"

let harness
let originalPostgresUrl
let originalNodeEnv

before(async () => {
  if (!hasIntegrationDatabase()) {
    return
  }

  originalPostgresUrl = process.env.POSTGRES_URL
  originalNodeEnv = process.env.NODE_ENV
  process.env.POSTGRES_URL = process.env.PLAYTT_TEST_DATABASE_URL
  process.env.NODE_ENV = "production"

  harness = await createDisposableMigrationHarness()
  await harness.applyAllMigrationsAndSeed()
})

after(async () => {
  if (originalPostgresUrl === undefined) {
    delete process.env.POSTGRES_URL
  } else {
    process.env.POSTGRES_URL = originalPostgresUrl
  }

  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV
  } else {
    process.env.NODE_ENV = originalNodeEnv
  }

  await harness?.teardown()
})

test("0025 foundation tables exist after full migration replay", async (t) => {
  if (!hasIntegrationDatabase()) {
    t.skip("PLAYTT_TEST_DATABASE_URL is not configured")
    return
  }

  await assertVenueEdgeFoundationTables(harness.sql)
})

test("legacy topology backfill dry-run and apply preserve v1 assignments", async (t) => {
  if (!hasIntegrationDatabase()) {
    t.skip("PLAYTT_TEST_DATABASE_URL is not configured")
    return
  }

  await seedSyntheticLegacyVenueEdgeAssignment(harness.sql)
  const rows = await loadLegacyRowsForRehearsal(harness.sql)
  const plan = planLegacyVenueEdgeTopology(rows)
  const summary = summarizeLegacyVenueEdgePlan(plan)

  assert.equal(summary.assignmentsEligible, 1)
  assert.equal(summary.credentialBearingAssignments, 1)

  const dryRunReport = credentialFreeRehearsalReport(summary, null, plan.skipped)
  assert.equal(dryRunReport.configPublished, false)
  assert.equal(dryRunReport.productionDatabaseMutated, false)
  assert.doesNotMatch(JSON.stringify(dryRunReport), /rehearsal-password/)

  const inserted = await applyLegacyVenueEdgeTopologyPlan(harness.sql, plan)
  assert.equal(inserted.recorders, 1)
  assert.equal(inserted.sources, 1)
  assert.equal(inserted.routes, 1)
  assert.equal(inserted.policies, 1)
  assert.equal(inserted.unresolvedLocalSecretRefs, 1)

  const [assignment] = await harness.sql`
    select id, config
    from device_assignments
    where id = ${REHEARSAL_ASSIGNMENT_ID}::uuid
  `
  assert.ok(assignment)
  assert.match(JSON.stringify(assignment.config), /rehearsal-password/)

  await assertNoCredentialLeakInTopology(harness.sql)

  const applyReport = credentialFreeRehearsalReport(summary, inserted, plan.skipped)
  assert.equal(applyReport.mode, "apply")
  assert.equal(applyReport.configPublished, false)
})

test("v2 rollout flag disable and re-enable blocks config v2 without dropping topology", async (t) => {
  if (!hasIntegrationDatabase()) {
    t.skip("PLAYTT_TEST_DATABASE_URL is not configured")
    return
  }

  const { assertVenueEdgeConfigV2Enabled } = await import(
    "../../src/server/replays/venue-edge-config-v2-gate.ts"
  )
  const { isVenueEdgeConfigV2EnabledForLocation } = await import(
    "../../src/server/replays/feature-policy.ts"
  )

  await setVenueEdgeConfigV2Flag(harness.sql, true, {
    locationIds: [REHEARSAL_LOCATION_ID],
  })
  assert.equal(
    await isVenueEdgeConfigV2EnabledForLocation(
      REHEARSAL_TENANT_ID,
      REHEARSAL_LOCATION_ID,
    ),
    true,
  )
  await assertVenueEdgeConfigV2Enabled(REHEARSAL_TENANT_ID, REHEARSAL_LOCATION_ID)

  await setVenueEdgeConfigV2Flag(harness.sql, false)
  assert.equal(
    await isVenueEdgeConfigV2EnabledForLocation(
      REHEARSAL_TENANT_ID,
      REHEARSAL_LOCATION_ID,
    ),
    false,
  )

  await assert.rejects(
    () => assertVenueEdgeConfigV2Enabled(REHEARSAL_TENANT_ID, REHEARSAL_LOCATION_ID),
    /not enabled for this venue/,
  )

  const [topologyCount] = await harness.sql`
    select count(*)::int as count
    from replay_recorders
    where tenant_id = ${REHEARSAL_TENANT_ID}::uuid
      and location_id = ${REHEARSAL_LOCATION_ID}::uuid
  `
  assert.ok(topologyCount.count > 0)

  const [assignmentCount] = await harness.sql`
    select count(*)::int as count
    from device_assignments
    where tenant_id = ${REHEARSAL_TENANT_ID}::uuid
      and role = 'venue_edge'
  `
  assert.ok(assignmentCount.count > 0)

  await setVenueEdgeConfigV2Flag(harness.sql, true, {
    locationIds: [REHEARSAL_LOCATION_ID],
  })
  assert.equal(
    await isVenueEdgeConfigV2EnabledForLocation(
      REHEARSAL_TENANT_ID,
      REHEARSAL_LOCATION_ID,
    ),
    true,
  )
})
