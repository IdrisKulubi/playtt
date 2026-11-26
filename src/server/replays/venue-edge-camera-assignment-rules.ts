// Pure rules for admin table ↔ camera assignments (no database access), kept
// separate so they can be unit tested directly.

export interface CameraAssignmentInput {
  tableId: string
  primaryCameraId: string | null
  backupCameraId: string | null
}

export class CameraAssignmentValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CameraAssignmentValidationError"
  }
}

/** Object key for one camera's latest preview still. */
export function cameraStillObjectKey(input: {
  tenantId: string
  installationId: string
  recorderId: string
  channelKey: string
}): string {
  const channel = input.channelKey.replace(/[^A-Za-z0-9_-]/g, "_")
  return `venue-edge/stills/${input.tenantId}/${input.installationId}/${input.recorderId}/${channel}.jpg`
}

/**
 * Validates and normalises an assignment list: known tables and cameras only,
 * no table twice, the backup differs from the main camera, and a backup needs
 * a main camera.
 */
export function normaliseCameraAssignments(
  input: CameraAssignmentInput[],
  known: { tableIds: Set<string>; cameraIds: Set<string> },
): CameraAssignmentInput[] {
  const seen = new Set<string>()
  return input.map((assignment) => {
    if (!known.tableIds.has(assignment.tableId)) {
      throw new CameraAssignmentValidationError("A table in this change doesn't belong to this venue.")
    }
    if (seen.has(assignment.tableId)) {
      throw new CameraAssignmentValidationError("Each table can only appear once in a change.")
    }
    seen.add(assignment.tableId)
    for (const cameraId of [assignment.primaryCameraId, assignment.backupCameraId]) {
      if (cameraId && !known.cameraIds.has(cameraId)) {
        throw new CameraAssignmentValidationError("A camera in this change isn't connected to this venue's recorder.")
      }
    }
    const primaryCameraId = assignment.primaryCameraId ?? null
    const backupCameraId =
      primaryCameraId && assignment.backupCameraId && assignment.backupCameraId !== primaryCameraId
        ? assignment.backupCameraId
        : null
    return { tableId: assignment.tableId, primaryCameraId, backupCameraId }
  })
}
