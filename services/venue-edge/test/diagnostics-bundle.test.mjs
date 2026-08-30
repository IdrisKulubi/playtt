import assert from "node:assert/strict"
import test from "node:test"

import {
  assertSupportBundleSafe,
  buildSupportBundle,
} from "../src/diagnostics/bundle.ts"

test("support bundle redacts injected secrets and stays bounded", async () => {
  const bundle = await buildSupportBundle({
    env: {
      dataDir: ".",
      reservedFreeDiskBytes: 1_000_000,
    },
    installationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    currentVersion: "0.2.0",
    platform: "win32",
    architecture: "x64",
    topology: {
      nvrs: [
        {
          id: "nvr-1",
          label: "Front desk",
          host: "10.0.0.20",
          password: "super-secret-password",
          username: "admin",
        },
      ],
      cameras: [
        {
          id: "cam-1",
          label: "Table 1",
          streamUrl: "rtsp://user:pass@camera.local/stream",
        },
      ],
      resourceRoutes: [
        {
          resourceId: "resource-1",
          pairingCode: "ABCD-EFGHJK",
        },
      ],
    },
    recentFailureCodes: [
      "upload_failed",
      "Device 11111111-1111-1111-1111-111111111111 leaked-device-secret",
    ],
  })

  assert.equal(bundle.installationId, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
  assert.ok(bundle.topology)
  assertSupportBundleSafe(bundle, [
    "super-secret-password",
    "rtsp://user:pass@camera.local/stream",
    "ABCD-EFGHJK",
    "leaked-device-secret",
  ])
})
