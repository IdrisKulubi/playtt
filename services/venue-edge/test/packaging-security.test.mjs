import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import { assessWindowsPowerSnapshot } from "../src/health/host-sleep-risk.ts"
import { generateSbom } from "../scripts/generate-sbom.mjs"

const serviceRoot = join(dirname(fileURLToPath(import.meta.url)), "..")

test("runtime pins use immutable HTTPS URLs and mandatory SHA-256 values", async () => {
  const pins = JSON.parse(
    await readFile(join(serviceRoot, "packaging", "pins.json"), "utf8")
  )
  for (const name of ["node", "ffmpeg", "winsw"]) {
    assert.match(pins[name].url, /^https:\/\//)
    assert.doesNotMatch(pins[name].url, /\/latest\/|-latest-/)
    assert.match(pins[name].sha256, /^[a-f0-9]{64}$/)
  }
})

test("release signing fails closed and verifies Authenticode", async () => {
  const script = await readFile(
    join(serviceRoot, "packaging", "sign.ps1"),
    "utf8"
  )
  assert.match(script, /VENUE_EDGE_SIGNING_CERT is required/)
  assert.match(script, /verify \/pa \/all \/v/)
  assert.match(script, /https:\/\/timestamp\.digicert\.com/)
})

test("Windows service uses a restricted account and data ACL", async () => {
  const [xml, acl] = await Promise.all([
    readFile(
      join(serviceRoot, "packaging", "winsw", "PlayTTVenueEdge.xml"),
      "utf8"
    ),
    readFile(join(serviceRoot, "packaging", "acl.ps1"), "utf8"),
  ])
  assert.match(xml, /<user>LocalService<\/user>/)
  assert.match(xml, /VENUE_EDGE_SECRET_STORE" value="dpapi"/)
  assert.match(acl, /\*S-1-5-19:\(OI\)\(CI\)M/)
  assert.doesNotMatch(acl, /S-1-5-32-545/)
})

test("SBOM contains pinned component hashes", async () => {
  const outputPath = join(serviceRoot, "dist", "test-sbom.spdx.json")
  const document = await generateSbom({
    pinsPath: join(serviceRoot, "packaging", "pins.json"),
    packagePath: join(serviceRoot, "package.json"),
    outputPath,
    createdAt: "1970-01-01T00:00:00Z",
  })
  assert.equal(document.spdxVersion, "SPDX-2.3")
  assert.equal(document.packages.length, 4)
  assert.equal(
    document.packages.filter(
      (entry) => entry.checksums?.[0]?.algorithm === "SHA256"
    ).length,
    3
  )
})

test("AC sleep and unverified policies are surfaced as risks", () => {
  assert.equal(
    assessWindowsPowerSnapshot({ onBattery: false, acSleepSeconds: 900 })
      .hostSleepRisk,
    true
  )
  assert.equal(
    assessWindowsPowerSnapshot({
      onBattery: false,
      acSleepSeconds: 0,
      acHibernateSeconds: 0,
    }).hostSleepRisk,
    false
  )
})
