import assert from "node:assert/strict"
import test from "node:test"

import {
  assertSupportBundleSafe,
  buildSupportBundle,
} from "../src/diagnostics/bundle.ts"

test("support bundle redacts secrets and stays bounded", async () => {
  const bundle = await buildSupportBundle({
    env: {
      dataDir: ".",
      reservedFreeDiskBytes: 1_000_000,
    },
    installationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    currentVersion: "0.2.0",
    platform: "win32",
    architecture: "x64",
    recentFailureCodes: ["upload_failed"],
  })

  assert.equal(bundle.installationId, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
  assertSupportBundleSafe(bundle, [
    "super-secret-password",
    "rtsp://user:pass@camera.local/stream",
  ])
})
