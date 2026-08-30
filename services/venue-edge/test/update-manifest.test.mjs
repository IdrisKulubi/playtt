import { generateKeyPairSync } from "node:crypto"
import assert from "node:assert/strict"
import test from "node:test"

import {
  canonicalizeUpdateManifestPayload,
  signUpdateManifest,
  validateUpdateManifest,
  verifyUpdateManifestSignature,
} from "../src/update/manifest.ts"

const { privateKey, publicKey } = generateKeyPairSync("ed25519")
const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString()
const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString()

const payload = {
  attemptId: "11111111-1111-1111-1111-111111111111",
  installationId: "22222222-2222-2222-2222-222222222222",
  version: "0.2.0",
  channel: "stable",
  minimumSupportedVersion: "0.1.0",
  platform: "win32",
  architecture: "x64",
  artifactUrl: "https://downloads.example.com/artifact.zip",
  sha256: "c".repeat(64),
  rolloutCohort: null,
  deadline: new Date(Date.now() + 60_000).toISOString(),
}

test("edge update manifest verifier accepts valid signed manifest", () => {
  const signed = signUpdateManifest(payload, privateKeyPem)
  assert.equal(verifyUpdateManifestSignature(signed, publicKeyPem), true)
  assert.equal(
    validateUpdateManifest({
      manifest: signed,
      currentVersion: "0.1.0",
      platform: "win32",
      architecture: "x64",
      publicKeyPem,
    }).valid,
    true,
  )
})

test("edge update manifest verifier rejects unsigned manifest", () => {
  const validation = validateUpdateManifest({
    manifest: { ...payload, signature: "" },
    currentVersion: "0.1.0",
    platform: "win32",
    architecture: "x64",
    publicKeyPem,
  })

  assert.equal(validation.valid, false)
  assert.equal(validation.code, "UPDATE_MANIFEST_UNSIGNED")
})

test("edge update manifest verifier rejects tampered manifest", () => {
  const signed = signUpdateManifest(payload, privateKeyPem)
  const validation = validateUpdateManifest({
    manifest: { ...signed, version: "9.9.9" },
    currentVersion: "0.1.0",
    platform: "win32",
    architecture: "x64",
    publicKeyPem,
  })

  assert.equal(validation.valid, false)
  assert.equal(validation.code, "UPDATE_MANIFEST_TAMPERED")
})

test("edge update manifest verifier rejects wrong platform and architecture", () => {
  const signed = signUpdateManifest(payload, privateKeyPem)

  assert.equal(
    validateUpdateManifest({
      manifest: signed,
      currentVersion: "0.1.0",
      platform: "linux",
      architecture: "x64",
      publicKeyPem,
    }).code,
    "UPDATE_MANIFEST_WRONG_PLATFORM",
  )

  assert.equal(
    validateUpdateManifest({
      manifest: signed,
      currentVersion: "0.1.0",
      platform: "win32",
      architecture: "arm64",
      publicKeyPem,
    }).code,
    "UPDATE_MANIFEST_WRONG_ARCHITECTURE",
  )
})

test("edge update manifest verifier rejects expired and downgrade manifests", () => {
  const signed = signUpdateManifest(payload, privateKeyPem)

  assert.equal(
    validateUpdateManifest({
      manifest: signed,
      currentVersion: "0.1.0",
      platform: "win32",
      architecture: "x64",
      publicKeyPem,
      now: new Date(Date.now() + 120_000),
    }).code,
    "UPDATE_MANIFEST_EXPIRED",
  )

  assert.equal(
    validateUpdateManifest({
      manifest: signUpdateManifest(
        { ...payload, version: "0.0.1", channel: "stable" },
        privateKeyPem,
      ),
      currentVersion: "0.2.0",
      platform: "win32",
      architecture: "x64",
      publicKeyPem,
    }).code,
    "UPDATE_MANIFEST_DOWNGRADE",
  )
})

test("canonical update manifest payload is stable", () => {
  const first = canonicalizeUpdateManifestPayload(payload)
  const second = canonicalizeUpdateManifestPayload({
    ...payload,
    rolloutCohort: null,
  })
  assert.equal(first, second)
})
