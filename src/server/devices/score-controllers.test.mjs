import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import {
  ControllerPlanError,
  controllerLabel,
  isControllerOnline,
  planControllerPlacement,
} from "./score-controller-plan.ts"

const repoRoot = join(import.meta.dirname, "..", "..", "..")
const read = (path) => readFileSync(join(repoRoot, path), "utf8")
const tables = { tableIds: new Set(["t1", "t2", "t3"]) }
const placed = (entries) => new Map(entries)

test("a spare controller goes onto an empty table", () => {
  const changes = planControllerPlacement(placed([["a", "t1"], ["b", null]]), [{ tableId: "t2", controllerId: "b" }], tables)
  assert.deepEqual([...changes], [["b", "t2"]])
})

test("taking a controller from another table leaves that table empty", () => {
  const changes = planControllerPlacement(placed([["a", "t1"]]), [{ tableId: "t2", controllerId: "a" }], tables)
  assert.deepEqual([...changes], [["a", "t2"]])
})

test("two requests swap controllers between tables", () => {
  const changes = planControllerPlacement(
    placed([["a", "t1"], ["b", "t2"]]),
    [
      { tableId: "t1", controllerId: "b" },
      { tableId: "t2", controllerId: "a" },
    ],
    tables,
  )
  assert.equal(changes.get("a"), "t2")
  assert.equal(changes.get("b"), "t1")
})

test("replacing a table's controller makes the old one a spare", () => {
  const changes = planControllerPlacement(placed([["a", "t1"], ["b", null]]), [{ tableId: "t1", controllerId: "b" }], tables)
  assert.equal(changes.get("a"), null)
  assert.equal(changes.get("b"), "t1")
})

test("clearing a table frees its controller; unchanged ones aren't touched", () => {
  const changes = planControllerPlacement(
    placed([["a", "t1"], ["b", "t2"]]),
    [{ tableId: "t1", controllerId: null }],
    tables,
  )
  assert.deepEqual([...changes], [["a", null]])
})

test("tables and controllers must belong to the venue", () => {
  assert.throws(() => planControllerPlacement(placed([["a", null]]), [{ tableId: "elsewhere", controllerId: "a" }], tables), ControllerPlanError)
  assert.throws(() => planControllerPlacement(placed([["a", null]]), [{ tableId: "t1", controllerId: "stranger" }], tables), ControllerPlanError)
})

test("labels and online state", () => {
  assert.equal(controllerLabel("esp32s3-ff74d1da"), "Controller FF74D1DA")
  const now = Date.parse("2026-11-26T10:00:00Z")
  assert.equal(isControllerOnline(new Date(now - 30_000), now), true)
  assert.equal(isControllerOnline(new Date(now - 5 * 60_000), now), false)
  assert.equal(isControllerOnline(null, now), false)
})

test("placement frees every moving controller before assigning, in one transaction", () => {
  const source = read("src/server/devices/score-controllers.ts")
  const save = source.slice(source.indexOf("export async function saveScoreControllerPlacement"))
  const transaction = save.slice(save.indexOf("db.transaction"))
  assert.ok(transaction.indexOf("releaseController") < transaction.indexOf("insert(deviceAssignments)"))
  assert.match(save, /validateDeviceAssignmentPolicy/)
  assert.match(save, /authorize\(context, "venue\.manage"\)/)
})

test("moving venue keeps the controller's credentials and only changes its home", () => {
  const source = read("src/server/devices/score-controllers.ts")
  const move = source.slice(source.indexOf("export async function moveScoreControllerToVenue"))
  assert.match(move, /set\(\{ locationId: input\.toVenueId/)
  assert.doesNotMatch(move, /deviceCredentials|revokeDevice/)
  assert.match(move, /controller\.status === "revoked"/)
})
