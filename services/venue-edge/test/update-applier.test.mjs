import { execFile } from "node:child_process"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import assert from "node:assert/strict"
import test from "node:test"

import {
  applyStagedUpdate,
  restorePreviousInstall,
} from "../src/update/applier.ts"
import { stageUpdateBundle } from "../src/update/stager.ts"
import { writeInstallVersion } from "../src/update/release-tree.ts"

const execFileAsync = promisify(execFile)

async function createZipFromDirectory(sourceDir, zipPath) {
  if (process.platform === "win32") {
    await execFileAsync("powershell", [
      "-NoProfile",
      "-Command",
      `Compress-Archive -Path '${sourceDir.replace(/'/g, "''")}\\*' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`,
    ])
    return
  }

  await execFileAsync("zip", ["-r", zipPath, "."], { cwd: sourceDir })
}

test("applyStagedUpdate swaps release tree and restorePreviousInstall rolls back", async () => {
  const root = await mkdtemp(join(tmpdir(), "venue-edge-apply-"))
  const dataDir = join(root, "data")
  const installRoot = join(root, "install")
  const payloadDir = join(root, "payload-v2")

  process.env.VENUE_EDGE_INSTALL_ROOT = installRoot

  try {
    await mkdir(installRoot, { recursive: true })
    await mkdir(payloadDir, { recursive: true })
    await writeInstallVersion(installRoot, "0.1.0")
    await writeFile(join(installRoot, "app.txt"), "v1", "utf8")

    await mkdir(join(payloadDir, "nested"), { recursive: true })
    await writeFile(join(payloadDir, "app.txt"), "v2", "utf8")
    await writeFile(join(payloadDir, "nested", "marker.txt"), "ok", "utf8")

    const zipPath = join(root, "artifact.zip")
    await createZipFromDirectory(payloadDir, zipPath)

    const staged = await stageUpdateBundle({
      dataDir,
      attemptId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      artifactPath: zipPath,
      version: "0.2.0",
    })

    const applied = await applyStagedUpdate({
      dataDir,
      attemptId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      version: "0.2.0",
      stagedDir: staged.stagedDir,
    })

    assert.equal(applied.appliedVersion, "0.2.0")
    assert.equal(await readFile(join(installRoot, "app.txt"), "utf8"), "v2")
    assert.equal(
      await readFile(join(installRoot, "nested", "marker.txt"), "utf8"),
      "ok",
    )

    const restored = await restorePreviousInstall(dataDir)
    assert.equal(restored.restoredVersion, "0.1.0")
    assert.equal(await readFile(join(installRoot, "app.txt"), "utf8"), "v1")
  } finally {
    delete process.env.VENUE_EDGE_INSTALL_ROOT
    await rm(root, { recursive: true, force: true })
  }
})
