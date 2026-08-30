import { createPrivateKey, generateKeyPairSync, sign } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry))
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((accumulator, key) => {
        accumulator[key] = canonicalize(value[key])
        return accumulator
      }, {})
  }

  return value
}

function signPayload(payload, privateKeyPem) {
  const canonical = JSON.stringify(canonicalize(payload))
  const key = createPrivateKey(privateKeyPem)
  return sign(null, Buffer.from(canonical, "utf8"), key).toString("base64")
}

const [
  pinsPath,
  artifactRoot,
  setupHash,
  setupFileName,
  builtAt,
] = process.argv.slice(2)

if (!pinsPath || !artifactRoot || !setupHash || !setupFileName) {
  console.error(
    "Usage: node generate-update-manifest.mjs <pins.json> <artifactRoot> <setupHash> <setupFileName> [builtAt]",
  )
  process.exit(1)
}

const pins = JSON.parse(readFileSync(resolve(pinsPath), "utf8"))
const version = pins.packageVersion
const privateKeyPem =
  process.env.VENUE_EDGE_UPDATE_PRIVATE_KEY?.trim() ??
  generateKeyPairSync("ed25519").privateKey.export({
    type: "pkcs8",
    format: "pem",
  })

const payload = {
  attemptId: "00000000-0000-0000-0000-000000000000",
  installationId: "00000000-0000-0000-0000-000000000000",
  version,
  channel: process.env.VENUE_EDGE_UPDATE_CHANNEL ?? "development",
  minimumSupportedVersion: "0.1.0",
  platform: "win32",
  architecture: "x64",
  artifactUrl:
    process.env.VENUE_EDGE_UPDATE_ARTIFACT_URL ??
    `file:///${setupFileName.replace(/\\/g, "/")}`,
  sha256: setupHash.toLowerCase(),
  rolloutCohort: null,
  deadline: null,
}

const manifest = {
  ...payload,
  signature: signPayload(payload, privateKeyPem),
  builtAt: builtAt ?? new Date().toISOString(),
  signed: Boolean(process.env.VENUE_EDGE_UPDATE_PRIVATE_KEY?.trim()),
}

writeFileSync(
  resolve(artifactRoot, "update-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
)

console.log(`Wrote ${resolve(artifactRoot, "update-manifest.json")}`)
