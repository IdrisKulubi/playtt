#!/usr/bin/env node
// Copies the latest ESP32 controller build into public/ so the admin
// "Set up controller" page can flash it from the browser (Web Serial).
//
//   cd firmware/esp32-controller && idf.py build
//   node scripts/publish-esp32-firmware.mjs
//
// Files are flashed at their own offsets (bootloader, partition table, app),
// never as one merged image, so the NVS area holding Wi-Fi and device
// credentials is left untouched on updates.

import { createHash } from "node:crypto"
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { basename, dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const firmwareRoot = join(repoRoot, "firmware", "esp32-controller")
const buildDir = join(firmwareRoot, "build")
const outDir = join(repoRoot, "public", "firmware", "esp32-controller")

const configHeader = readFileSync(join(firmwareRoot, "main", "playtt_config.h"), "utf8")
const version = configHeader.match(/PLAYTT_FIRMWARE_VERSION\s+"([^"]+)"/)?.[1]
if (!version) throw new Error("PLAYTT_FIRMWARE_VERSION not found in playtt_config.h")

const flashArgs = readFileSync(join(buildDir, "flash_args"), "utf8").trim().split(/\r?\n/)
const options = flashArgs[0]
const flashMode = options.match(/--flash-mode\s+(\S+)/)?.[1] ?? "dio"
const flashFreq = options.match(/--flash-freq\s+(\S+)/)?.[1] ?? "80m"
const flashSize = options.match(/--flash-size\s+(\S+)/)?.[1] ?? "keep"

// Replace the previous release so stale binaries are never served.
rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

const files = flashArgs.slice(1).map((line) => {
  const [address, relativePath] = line.trim().split(/\s+/)
  const source = join(buildDir, relativePath)
  const name = basename(relativePath)
  const data = readFileSync(source)
  copyFileSync(source, join(outDir, name))
  return {
    path: `/firmware/esp32-controller/${name}`,
    address: Number.parseInt(address, 16),
    size: statSync(source).size,
    sha256: createHash("sha256").update(data).digest("hex"),
  }
})

const manifest = {
  name: "PlayTT score controller",
  chip: "esp32s3",
  version,
  builtAt: new Date().toISOString(),
  flashMode,
  flashFreq,
  flashSize,
  files,
}
writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)

console.log(`Published ${version} (${files.length} files) to public/firmware/esp32-controller:`)
for (const name of readdirSync(outDir)) console.log(`  ${name}`)
