import { createWriteStream } from "node:fs"
import { mkdir, readFile, rename, stat } from "node:fs/promises"
import { dirname, join } from "node:path"
import { pipeline } from "node:stream/promises"
import { Readable } from "node:stream"

import { hashUpdateArtifact } from "./manifest"

const DEFAULT_MAX_BYTES = 512 * 1024 * 1024

export interface DownloadUpdateArtifactInput {
  url: string
  destinationPath: string
  expectedSha256: string
  fetchImpl?: typeof fetch
  maxBytes?: number
  resumeFromBytes?: number
}

export interface DownloadUpdateArtifactResult {
  path: string
  sha256: string
  bytesWritten: number
}

export async function downloadUpdateArtifact(
  input: DownloadUpdateArtifactInput,
): Promise<DownloadUpdateArtifactResult> {
  if (!/^https:\/\//i.test(input.url)) {
    throw new Error("UPDATE_DOWNLOAD_INSECURE_URL")
  }

  const fetchImpl = input.fetchImpl ?? fetch
  const maxBytes = input.maxBytes ?? DEFAULT_MAX_BYTES
  const partPath = `${input.destinationPath}.part`
  await mkdir(dirname(partPath), { recursive: true })

  const headers: Record<string, string> = {}
  if (input.resumeFromBytes && input.resumeFromBytes > 0) {
    headers.Range = `bytes=${input.resumeFromBytes}-`
  }

  const response = await fetchImpl(input.url, { headers })
  if (!response.ok || !response.body) {
    throw new Error(`UPDATE_DOWNLOAD_FAILED:${response.status}`)
  }

  const resuming = Boolean(input.resumeFromBytes && input.resumeFromBytes > 0)
  const serverResumed = resuming && response.status === 206

  const writeStream = createWriteStream(partPath, {
    flags: serverResumed ? "a" : "w",
  })

  let bytesWritten = serverResumed ? (input.resumeFromBytes ?? 0) : 0
  const reader = Readable.fromWeb(response.body as never)

  reader.on("data", (chunk: Buffer) => {
    bytesWritten += chunk.length
    if (bytesWritten > maxBytes) {
      reader.destroy(new Error("UPDATE_DOWNLOAD_TOO_LARGE"))
    }
  })

  await pipeline(reader, writeStream)
  const fileBuffer = await readFile(partPath)
  const sha256 = hashUpdateArtifact(fileBuffer)

  if (sha256.toLowerCase() !== input.expectedSha256.toLowerCase()) {
    throw new Error("UPDATE_DOWNLOAD_HASH_MISMATCH")
  }

  await rename(partPath, input.destinationPath)

  const fileStat = await stat(input.destinationPath)

  return {
    path: input.destinationPath,
    sha256,
    bytesWritten: fileStat.size,
  }
}

export async function readPartialDownloadBytes(partPath: string): Promise<number> {
  try {
    const fileStat = await stat(partPath)
    return fileStat.size
  } catch {
    return 0
  }
}

export function resolveStagedArtifactPath(dataDir: string, attemptId: string): string {
  return join(dataDir, "updates", "staging", `${attemptId}.zip`)
}
