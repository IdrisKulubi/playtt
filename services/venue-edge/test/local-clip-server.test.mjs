import assert from "node:assert/strict"
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { LocalClipServer, parseRange } from "../src/local-playback/clip-server.ts"

async function withServer(run, { now } = {}) {
  const root = await mkdtemp(join(tmpdir(), "local-clips-"))
  const source = join(root, "clip.mp4")
  await writeFile(source, Buffer.from("0123456789abcdef"))
  const server = new LocalClipServer({
    directory: join(root, "served"),
    port: 0,
    lanAddresses: () => ["192.168.1.20"],
    now,
  })
  await server.start()
  try {
    await run({ server, source, root })
  } finally {
    await server.stop()
    await rm(root, { recursive: true, force: true })
  }
}

function loopback(publication) {
  return publication.urls.find((url) => url.includes("127.0.0.1"))
}

test("a published clip is served with LAN and loopback links", async () => {
  await withServer(async ({ server, source }) => {
    const publication = await server.publish(source, 40)
    const port = server.getPort()

    assert.equal(publication.durationSeconds, 40)
    assert.match(publication.urls[0], new RegExp(`^http://192\\.168\\.1\\.20:${port}/clips/[A-Za-z0-9_-]{32}\\.mp4$`))
    assert.equal(publication.urls.length, 2)

    const response = await fetch(loopback(publication))
    assert.equal(response.status, 200)
    assert.equal(response.headers.get("content-type"), "video/mp4")
    assert.equal(response.headers.get("accept-ranges"), "bytes")
    assert.equal(await response.text(), "0123456789abcdef")
  })
})

test("range requests return the requested bytes", async () => {
  await withServer(async ({ server, source }) => {
    const url = loopback(await server.publish(source))
    const response = await fetch(url, { headers: { Range: "bytes=4-7" } })
    assert.equal(response.status, 206)
    assert.equal(response.headers.get("content-range"), "bytes 4-7/16")
    assert.equal(await response.text(), "4567")

    const bad = await fetch(url, { headers: { Range: "bytes=99-" } })
    assert.equal(bad.status, 416)
  })
})

test("unknown keys, other paths and expired clips are not served", async () => {
  let now = Date.parse("2026-11-28T12:00:00.000Z")
  await withServer(
    async ({ server, source }) => {
      const url = loopback(await server.publish(source))
      const base = new URL(url).origin

      assert.equal((await fetch(`${base}/clips/${"x".repeat(32)}.mp4`)).status, 404)
      assert.equal((await fetch(`${base}/`)).status, 404)
      assert.equal((await fetch(`${base}/clips/../clip.mp4`)).status, 404)
      assert.equal((await fetch(url, { method: "POST" })).status, 405)

      now += 15 * 60_000
      assert.equal((await fetch(url)).status, 404)
    },
    { now: () => now },
  )
})

test("expired clips are deleted from disk by the sweep", async () => {
  let now = Date.parse("2026-11-28T12:00:00.000Z")
  await withServer(
    async ({ server, source, root }) => {
      await server.publish(source)
      assert.equal((await readdir(join(root, "served"))).length, 1)
      now += 16 * 60_000
      await server.sweep()
      assert.equal((await readdir(join(root, "served"))).length, 0)
    },
    { now: () => now },
  )
})

test("parseRange handles open, suffix and invalid ranges", () => {
  assert.equal(parseRange(undefined, 10), null)
  assert.deepEqual(parseRange("bytes=2-", 10), { start: 2, end: 9 })
  assert.deepEqual(parseRange("bytes=-3", 10), { start: 7, end: 9 })
  assert.deepEqual(parseRange("bytes=0-99", 10), { start: 0, end: 9 })
  assert.equal(parseRange("bytes=5-2", 10), "invalid")
  assert.equal(parseRange("bytes=1-2,4-5", 10), "invalid")
  assert.equal(parseRange("items=0-1", 10), "invalid")
})
