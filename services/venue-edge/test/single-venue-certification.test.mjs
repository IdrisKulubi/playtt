import assert from "node:assert/strict"
import test from "node:test"

import { evaluateSingleVenueSimulatorEvidence } from "../src/certification/single-venue.ts"

test("single-venue simulator evidence selects the approved primary source", () => {
  const evidence = evaluateSingleVenueSimulatorEvidence()

  assert.equal(evidence.codec, "h264")
  assert.equal(evidence.clipWindowSeconds, 15)
  assert.equal(evidence.selectedSourceId, evidence.primarySourceId)
  assert.equal(evidence.commandAccepted, true)
  assert.equal(evidence.wrongResourceRejected, true)
})
