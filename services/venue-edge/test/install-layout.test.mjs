import assert from "node:assert/strict"
import { mkdtemp, mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import {
  isInstalledLayout,
  resolveBundledFfmpegPath,
  resolveDefaultDataDir,
  resolveDpapiScope,
  resolveInstallRoot,
  resolveInstalledDataDir,
} from "../src/config/install-layout.ts"
import { resolveFfmpegBinary } from "../src/ffmpeg/runner.ts"

test("installed layout resolves ProgramData and install root", () => {
  const previous = process.env.VENUE_EDGE_INSTALL_LAYOUT
  process.env.VENUE_EDGE_INSTALL_LAYOUT = "installed"

  assert.equal(isInstalledLayout(), true)
  assert.match(resolveDefaultDataDir(), /PlayTT[\\/]VenueEdge$/)
  assert.match(resolveInstalledDataDir(), /PlayTT[\\/]VenueEdge$/)
  assert.equal(resolveInstallRoot(), "C:\\Program Files\\PlayTT\\VenueEdge")
  assert.match(
    resolveBundledFfmpegPath("C:\\Program Files\\PlayTT\\VenueEdge"),
    /ffmpeg[\\/]ffmpeg\.exe$/,
  )

  process.env.VENUE_EDGE_INSTALL_ROOT = "D:\\Custom\\VenueEdge"
  assert.equal(resolveInstallRoot(), "D:\\Custom\\VenueEdge")
  delete process.env.VENUE_EDGE_INSTALL_ROOT

  if (previous === undefined) {
    delete process.env.VENUE_EDGE_INSTALL_LAYOUT
  } else {
    process.env.VENUE_EDGE_INSTALL_LAYOUT = previous
  }
})

test("dpapi scope uses LocalMachine only for installed layout", () => {
  assert.equal(resolveDpapiScope("simulate"), "currentUser")
  const previous = process.env.VENUE_EDGE_INSTALL_LAYOUT
  process.env.VENUE_EDGE_INSTALL_LAYOUT = "installed"
  assert.equal(resolveDpapiScope("production"), "localMachine")
  if (previous === undefined) {
    delete process.env.VENUE_EDGE_INSTALL_LAYOUT
  } else {
    process.env.VENUE_EDGE_INSTALL_LAYOUT = previous
  }
})

test("ffmpeg resolver prefers install root bundle when present", async () => {
  const previousLayout = process.env.VENUE_EDGE_INSTALL_LAYOUT
  const previousFfmpeg = process.env.FFMPEG_PATH
  const previousRoot = process.env.VENUE_EDGE_INSTALL_ROOT

  const installRoot = await mkdtemp(join(tmpdir(), "venue-edge-install-root-"))
  const ffmpegDir = join(installRoot, "ffmpeg")
  await mkdir(ffmpegDir, { recursive: true })
  const ffmpegPath = join(ffmpegDir, "ffmpeg.exe")
  await writeFile(ffmpegPath, "stub", { mode: 0o600 })

  delete process.env.FFMPEG_PATH
  process.env.VENUE_EDGE_INSTALL_LAYOUT = "installed"
  process.env.VENUE_EDGE_INSTALL_ROOT = installRoot

  assert.equal(resolveFfmpegBinary(), ffmpegPath)

  if (previousLayout === undefined) {
    delete process.env.VENUE_EDGE_INSTALL_LAYOUT
  } else {
    process.env.VENUE_EDGE_INSTALL_LAYOUT = previousLayout
  }

  if (previousFfmpeg === undefined) {
    delete process.env.FFMPEG_PATH
  } else {
    process.env.FFMPEG_PATH = previousFfmpeg
  }

  if (previousRoot === undefined) {
    delete process.env.VENUE_EDGE_INSTALL_ROOT
  } else {
    process.env.VENUE_EDGE_INSTALL_ROOT = previousRoot
  }
})
