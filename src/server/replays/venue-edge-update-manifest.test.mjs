import { generateKeyPairSync } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

const repoRoot = join(import.meta.dirname, "..", "..", "..")

test("update manifest module exports signing and validation helpers", () => {
  const manifestModule = readFileSync(
    join(repoRoot, "src/server/replays/venue-edge-update-manifest.ts"),
    "utf8",
  )

  assert.match(manifestModule, /signUpdateManifest/)
  assert.match(manifestModule, /verifyUpdateManifestSignature/)
  assert.match(manifestModule, /validateUpdateManifest/)
  assert.match(manifestModule, /isInstallationEligibleForRollout/)
})

test("update policy module resolves channel and rollout eligibility", () => {
  const policy = readFileSync(
    join(repoRoot, "src/server/replays/venue-edge-update-policy.ts"),
    "utf8",
  )

  assert.match(policy, /resolveEffectiveUpdateChannel/)
  assert.match(policy, /pickReleaseForInstallation/)
  assert.match(policy, /shouldOfferUpdate/)
})

test("Ed25519 signing round-trip matches manifest contract", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519")
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" })
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" })

  assert.match(String(privateKeyPem), /BEGIN PRIVATE KEY/)
  assert.match(String(publicKeyPem), /BEGIN PUBLIC KEY/)
})
