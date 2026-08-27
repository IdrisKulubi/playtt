/**
 * Minimal valid MP4 bytes (ftyp + mdat) for simulator uploads.
 * Deterministic per replay request id via seed mixing.
 */
export function createMinimalMp4Fixture(seed: string): Buffer {
  const ftyp = Buffer.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
    0x00, 0x00, 0x02, 0x00, 0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32,
  ])

  const seedByte = seed.charCodeAt(0) % 255
  const mdatPayload = Buffer.from([
    seedByte,
    0x00,
    0x00,
    0x01,
    0xb3,
    0x00,
    0x10,
    0x00,
  ])
  const mdatSize = mdatPayload.length + 8
  const mdatHeader = Buffer.alloc(8)
  mdatHeader.writeUInt32BE(mdatSize, 0)
  mdatHeader.write("mdat", 4)

  return Buffer.concat([ftyp, mdatHeader, mdatPayload])
}

export const PROTOCOL_FIXTURE_COMMAND = {
  id: "cmd-fixture-001",
  kind: "capture_replay",
  payload: {
    replayRequestId: "replay-req-fixture-001",
    replayId: "replay-fixture-001",
    mediaAssetId: "media-fixture-001",
    objectKey: "tenant/demo/replays/replay-fixture-001.mp4",
    captureAt: "2026-08-21T20:00:00.000Z",
    preRollSeconds: 12,
    postRollSeconds: 3,
    sourceType: "edge_buffer" as const,
    resourceId: "resource-fixture-001",
    configRevisionId: "55555555-5555-4555-8555-555555555555",
    playSessionId: "session-fixture-001",
    uploadGrant: {
      url: "https://r2.example/upload?X-Amz-Signature=fixture",
      expiresAt: "2026-08-21T20:05:00.000Z",
    },
  },
  expiresAt: "2026-08-21T20:10:00.000Z",
  correlationId: "corr-fixture-001",
  attemptCount: 1,
}

export const PROTOCOL_FIXTURE_EDGE_CONFIG = {
  configVersion: 1,
  resourceId: "resource-fixture-001",
  role: "venue_edge",
  assignment: {
    id: "assignment-fixture-001",
    locationId: "location-fixture-001",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    effectiveTo: null,
  },
  config: {
    camera: {
      id: "camera-fixture-001",
      label: "table-1",
      rtspUrl: "rtsp://cam.local/stream",
      password: "fixture-secret",
    },
  },
}
