import * as esbuild from "esbuild"
import { mkdir } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const outDir = join(packageRoot, "dist")

await mkdir(outDir, { recursive: true })

await esbuild.build({
  entryPoints: [join(packageRoot, "src/index.ts")],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: join(outDir, "index.js"),
  sourcemap: true,
  logLevel: "info",
})

console.log("VenueEdge bundle written to dist/index.js")
