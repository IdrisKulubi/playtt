import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { parseEdgeConfigV2 } from "../src/cloud/config-v2.ts"

const fixturesRoot = join(import.meta.dirname, "..", "fixtures")

function loadFixture(name) {
  return JSON.parse(readFileSync(join(fixturesRoot, name), "utf8"))
}

test("edge consumer accepts every frozen config v2 fixture", () => {
  for (const name of [
    "edge-v2-one-nvr.json",
    "edge-v2-three-nvr.json",
    "edge-v2-disabled-source.json",
    "edge-v2-manual-override.json",
    "edge-v2-cross-nvr-failover.json",
  ]) {
    const config = parseEdgeConfigV2(loadFixture(name))
    assert.equal(config.protocolVersion, "edge-v2", name)
  }
})

test("edge consumer rejects cross-resource and credentialized config", () => {
  const crossResource = loadFixture("edge-v2-one-nvr.json")
  crossResource.resourcePolicies[0].candidates[0].sourceId =
    "99999999-9999-4999-8999-999999999999"
  assert.throws(
    () => parseEdgeConfigV2(crossResource),
    /Invalid source candidate/
  )

  const credentialized = loadFixture("edge-v2-one-nvr.json")
  credentialized.recorders[0].password = "must-not-cross-cloud-boundary"
  assert.throws(
    () => parseEdgeConfigV2(credentialized),
    /forbidden secret field/
  )
})

test("edge client exposes the authenticated v2 application acknowledgement path", () => {
  const clientSource = readFileSync(
    join(import.meta.dirname, "..", "src", "cloud", "client.ts"),
    "utf8"
  )
  assert.match(clientSource, /acknowledgeConfigV2Application/)
  assert.match(clientSource, /\/api\/edge\/v2\/config\/applications/)
  assert.match(clientSource, /method: "POST"/)
  assert.match(clientSource, /x-playtt-edge-agent-version/)
})

test("edge cloud client fetches and validates the v2 route", async () => {
  const { EdgeV1Client } = await import("../src/cloud/client.ts")
  const expected = loadFixture("edge-v2-cross-nvr-failover.json")
  const calls = []
  const client = new EdgeV1Client({
    baseUrl: "https://www.theplaytt.com",
    deviceId: "device-id",
    secret: "device-secret",
    agentVersion: "0.2.0",
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), method: init?.method ?? "GET" })
      return new Response(JSON.stringify({ data: expected }), { status: 200 })
    },
  })

  const config = await client.getConfigV2()
  assert.equal(config.resourcePolicies[0].candidates.length, 2)
  assert.deepEqual(calls, [
    { url: "https://www.theplaytt.com/api/edge/v2/config", method: "GET" },
  ])
})
