import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { mkdir } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { build } from "esbuild"

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const outDir = join(packageRoot, "dist")

await mkdir(outDir, { recursive: true })

await build({
  entryPoints: [join(packageRoot, "src/index.ts")],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: join(outDir, "index.js"),
  logLevel: "silent",
})

assert.ok(existsSync(join(outDir, "index.js")), "dist/index.js should exist")

const {
  isInstalledLayout,
  resolveDefaultDataDir,
  resolveInstalledDataDir,
  resolveInstallRoot,
  resolveBundledFfmpegPath,
  resolveDpapiScope,
} = await import("../src/config/install-layout.ts")

process.env.VENUE_EDGE_INSTALL_LAYOUT = "installed"
assert.equal(isInstalledLayout(), true)
assert.match(resolveDefaultDataDir(), /PlayTT[\\/]VenueEdge$/)
assert.match(resolveInstalledDataDir(), /PlayTT[\\/]VenueEdge$/)
assert.equal(resolveInstallRoot(), "C:\\Program Files\\PlayTT\\VenueEdge")
assert.match(
  resolveBundledFfmpegPath("C:\\Program Files\\PlayTT\\VenueEdge"),
  /ffmpeg[\\/]ffmpeg\.exe$/,
)

delete process.env.VENUE_EDGE_INSTALL_LAYOUT
assert.equal(resolveDpapiScope("simulate"), "currentUser")

console.log("VenueEdge pack dry-run passed")
