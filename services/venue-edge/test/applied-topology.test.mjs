import test from "node:test"
import assert from "node:assert/strict"
import { topologySignature } from "../src/setup/applied-topology.ts"

test("applied topology ignores clocks and translated IDs but detects changed capture routes", () => {
  const config = {
    configRevision: { publishedAt: "2026-01-01T00:00:00Z" },
    recorders: [{ id: "local-nvr", localConnectionKey: "connection-1", enabled: true, label: "NVR", connection: { host: "192.168.0.82", rtspPort: 554 } }],
    sources: [{ id: "local-camera", recorderId: "local-nvr", channelKey: "1", streamProfile: "main", label: "Table", enabled: true, codec: "h264" }],
    resourcePolicies: [{ resourceId: "table-1", selectionMode: "automatic", manualSourceId: null, failover: {}, candidates: [{ sourceId: "local-camera", priority: 1, captureModes: ["edge_buffer"] }] }],
  }
  const applied = structuredClone(config)
  applied.configRevision.publishedAt = "2025-01-01T00:00:00Z"
  applied.recorders[0].id = "cloud-nvr"
  applied.sources[0].recorderId = "cloud-nvr"
  applied.sources[0].id = "cloud-camera"
  applied.resourcePolicies[0].candidates[0].sourceId = "cloud-camera"
  assert.equal(topologySignature(config), topologySignature(applied))
  applied.sources[0].channelKey = "2"
  assert.notEqual(topologySignature(config), topologySignature(applied))
})
