import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

import {
  downloadUpdateArtifact,
  readPartialDownloadBytes,
} from "../src/update/downloader.ts"
import { hashUpdateArtifact } from "../src/update/manifest.ts"

test("downloadUpdateArtifact resumes with range and restarts when server returns 200", async () => {
  const root = await mkdtemp(join(tmpdir(), "venue-edge-download-"))
  const destinationPath = join(root, "artifact.zip")
  const payload = Buffer.from("phase-seven-update-payload")
  const sha256 = hashUpdateArtifact(payload)

  try {
    const firstFetch = async (_url, init) => {
      const range = init?.headers?.Range
      assert.equal(range, "bytes=5-")
      return new Response(payload.subarray(5), {
        status: 206,
        headers: { "content-type": "application/zip" },
      })
    }

    await writeFile(`${destinationPath}.part`, payload.subarray(0, 5))

    const resumed = await downloadUpdateArtifact({
      url: "https://downloads.example.com/artifact.zip",
      destinationPath,
      expectedSha256: sha256,
      fetchImpl: firstFetch,
      resumeFromBytes: 5,
    })

    assert.equal(resumed.sha256, sha256)
    assert.equal((await readFile(destinationPath)).toString(), payload.toString())

    const restartFetch = async () =>
      new Response(payload, {
        status: 200,
        headers: { "content-type": "application/zip" },
      })

    await writeFile(`${destinationPath}.part`, payload.subarray(0, 3))
    const restarted = await downloadUpdateArtifact({
      url: "https://downloads.example.com/artifact.zip",
      destinationPath: join(root, "artifact-2.zip"),
      expectedSha256: sha256,
      fetchImpl: restartFetch,
      resumeFromBytes: 3,
    })

    assert.equal(restarted.bytesWritten, payload.length)
    assert.equal(await readPartialDownloadBytes(`${destinationPath}.part`), 3)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
