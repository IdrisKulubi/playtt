import assert from "node:assert/strict"
import test from "node:test"
import { commissioningReportMatchesConfig } from "./venue-edge-report-config.ts"

const report = {
  nvrs: [{ id: "nvr", label: "Recorder", vendor: "vigi", host: "192.168.1.2", rtspPort: 554, localConnectionKey: "local-nvr", enabled: true }],
  cameras: [{ id: "camera", nvrId: "nvr", label: "Table camera", channelKey: "1", streamProfile: "main", codec: "h264", enabled: true }],
  resourceRoutes: [{ resourceId: "table", cameraId: "camera", priority: 1, captureModes: ["live", "playback"], enabled: true }],
  resourcePolicies: [],
}
const config = {
  recorders: [{ id: "nvr", label: "Recorder", vendor: "vigi", connection: { host: "192.168.1.2", rtspPort: 554 }, localConnectionKey: "local-nvr", enabled: true }],
  sources: [{ id: "camera", recorderId: "nvr", label: "Table camera", channelKey: "1", streamProfile: "main", codec: "h264", enabled: true }],
  resourcePolicies: [{ resourceId: "table", selectionMode: "automatic", manualSourceId: null, failover: { failureThreshold: 3, cooldownSeconds: 60, healthyThreshold: 2, autoFailback: true }, candidates: [{ sourceId: "camera", priority: 1, captureModes: ["playback", "live"] }] }],
}

test("completion and live test telemetry do not invalidate applied configuration", () => {
  assert.equal(commissioningReportMatchesConfig({ ...report, commissioned: true, reportVersion: 99, publishedAt: "later", cameras: report.cameras.map((camera) => ({ ...camera, lastTest: { passed: true }, healthStatus: "healthy" })), sourceHealth: [{ status: "healthy" }] }, config), true)
})

function remappedConfig() {
  return {
    ...config,
    recorders: config.recorders.map((recorder) => ({ ...recorder, id: "cloud-nvr" })),
    sources: config.sources.map((source) => ({ ...source, id: "cloud-camera", recorderId: "cloud-nvr" })),
    resourcePolicies: config.resourcePolicies.map((policy) => ({ ...policy, candidates: policy.candidates.map((candidate) => ({ ...candidate, sourceId: "cloud-camera" })) })),
  }
}

test("completed local reports match reconciled cloud IDs using connection and channel identity", () => {
  assert.equal(commissioningReportMatchesConfig(report, remappedConfig()), true)
  const manualReport = { ...report, resourcePolicies: [{ resourceId: "table", selectionMode: "manual", manualSourceId: "camera" }] }
  const cloud = remappedConfig()
  cloud.resourcePolicies[0].selectionMode = "manual"
  cloud.resourcePolicies[0].manualSourceId = "cloud-camera"
  assert.equal(commissioningReportMatchesConfig(manualReport, cloud), true)
})

test("remapped IDs cannot hide changed settings or ambiguous device identities", () => {
  const cloud = remappedConfig()
  for (const changed of [
    { ...report, nvrs: report.nvrs.map((nvr) => ({ ...nvr, host: "192.168.1.3" })) },
    { ...report, nvrs: report.nvrs.map((nvr) => ({ ...nvr, localConnectionKey: "different-key" })) },
    { ...report, cameras: report.cameras.map((camera) => ({ ...camera, channelKey: "2" })) },
    { ...report, cameras: report.cameras.map((camera) => ({ ...camera, streamProfile: "sub" })) },
    { ...report, resourceRoutes: report.resourceRoutes.map((route) => ({ ...route, captureModes: ["live"] })) },
    { ...report, nvrs: [...report.nvrs, { ...report.nvrs[0], id: "duplicate" }] },
    { ...report, cameras: [...report.cameras, { ...report.cameras[0], id: "duplicate" }] },
  ]) assert.equal(commissioningReportMatchesConfig(changed, cloud), false)
})

test("real changes still require publication even when camera counts match", () => {
  for (const changed of [
    { ...report, nvrs: report.nvrs.map((nvr) => ({ ...nvr, host: "192.168.1.3" })) },
    { ...report, cameras: report.cameras.map((camera) => ({ ...camera, channelKey: "2" })) },
    { ...report, cameras: report.cameras.map((camera) => ({ ...camera, enabled: false })) },
    { ...report, resourceRoutes: report.resourceRoutes.map((route) => ({ ...route, priority: 2 })) },
    { ...report, resourceRoutes: report.resourceRoutes.map((route) => ({ ...route, captureModes: ["live"] })) },
    { ...report, resourcePolicies: [{ resourceId: "table", cooldownSeconds: 120 }] },
  ]) assert.equal(commissioningReportMatchesConfig(changed, config), false)
  assert.equal(commissioningReportMatchesConfig(null, config), false)
})
