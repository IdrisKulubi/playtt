import assert from "node:assert/strict"
import test from "node:test"

import {
  CameraAssignmentValidationError,
  cameraStillObjectKey,
  normaliseCameraAssignments,
} from "./venue-edge-camera-assignment-rules.ts"

const known = {
  tableIds: new Set(["table-1", "table-2"]),
  cameraIds: new Set(["cam-1", "cam-2", "cam-3"]),
}

test("a camera swap between two tables is accepted as-is", () => {
  assert.deepEqual(
    normaliseCameraAssignments(
      [
        { tableId: "table-1", primaryCameraId: "cam-2", backupCameraId: "cam-3" },
        { tableId: "table-2", primaryCameraId: "cam-1", backupCameraId: null },
      ],
      known,
    ),
    [
      { tableId: "table-1", primaryCameraId: "cam-2", backupCameraId: "cam-3" },
      { tableId: "table-2", primaryCameraId: "cam-1", backupCameraId: null },
    ],
  )
})

test("a backup equal to the main camera, or without a main camera, is dropped", () => {
  assert.deepEqual(
    normaliseCameraAssignments(
      [
        { tableId: "table-1", primaryCameraId: "cam-1", backupCameraId: "cam-1" },
        { tableId: "table-2", primaryCameraId: null, backupCameraId: "cam-2" },
      ],
      known,
    ).map((entry) => entry.backupCameraId),
    [null, null],
  )
})

test("unknown tables, unknown cameras and repeated tables are rejected", () => {
  assert.throws(() => normaliseCameraAssignments([{ tableId: "other", primaryCameraId: null, backupCameraId: null }], known), CameraAssignmentValidationError)
  assert.throws(() => normaliseCameraAssignments([{ tableId: "table-1", primaryCameraId: "cam-9", backupCameraId: null }], known), CameraAssignmentValidationError)
  assert.throws(
    () => normaliseCameraAssignments([
      { tableId: "table-1", primaryCameraId: "cam-1", backupCameraId: null },
      { tableId: "table-1", primaryCameraId: "cam-2", backupCameraId: null },
    ], known),
    CameraAssignmentValidationError,
  )
})

test("still object keys are scoped to tenant, installation and recorder", () => {
  assert.equal(
    cameraStillObjectKey({ tenantId: "t", installationId: "i", recorderId: "r", channelKey: "2" }),
    "venue-edge/stills/t/i/r/2.jpg",
  )
  assert.equal(
    cameraStillObjectKey({ tenantId: "t", installationId: "i", recorderId: "r", channelKey: "../x" }),
    "venue-edge/stills/t/i/r/___x.jpg",
  )
})
