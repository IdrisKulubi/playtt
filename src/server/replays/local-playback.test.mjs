import assert from "node:assert/strict"
import test from "node:test"

import {
  activeLocalPlayback,
  isAllowedLocalPlaybackUrl,
  MAX_LOCAL_PLAYBACK_TTL_MS,
  sanitizeLocalPlaybackReport,
} from "./local-playback.ts"

const key = "AbCdEfGhIjKlMnOpQrStUvWxYz012345"
const now = Date.parse("2026-11-28T12:00:00.000Z")

test("venue-LAN and loopback clip links are allowed", () => {
  for (const host of ["192.168.1.20:8787", "10.0.0.5:8787", "172.16.4.2", "127.0.0.1:8787", "localhost:8787"]) {
    assert.equal(isAllowedLocalPlaybackUrl(`http://${host}/clips/${key}.mp4`), true, host)
  }
})

test("public hosts, odd paths, credentials and queries are rejected", () => {
  for (const url of [
    `http://8.8.8.8/clips/${key}.mp4`,
    `http://evil.example/clips/${key}.mp4`,
    `http://172.32.0.1/clips/${key}.mp4`,
    `http://192.168.1.20/clips/../secret.mp4`,
    `http://192.168.1.20/clips/short.mp4`,
    `http://192.168.1.20/files/${key}.mp4`,
    `http://user:pw@192.168.1.20/clips/${key}.mp4`,
    `http://192.168.1.20/clips/${key}.mp4?x=1`,
    `ftp://192.168.1.20/clips/${key}.mp4`,
    "not a url",
  ]) {
    assert.equal(isAllowedLocalPlaybackUrl(url), false, url)
  }
})

test("reports keep valid links, cap the expiry and drop bad durations", () => {
  const report = sanitizeLocalPlaybackReport(
    {
      urls: [
        `http://192.168.1.20:8787/clips/${key}.mp4`,
        `http://8.8.8.8/clips/${key}.mp4`,
        `http://192.168.1.20:8787/clips/${key}.mp4`,
      ],
      expiresAt: new Date(now + 24 * 3_600_000).toISOString(),
      durationSeconds: 9_999,
    },
    now,
  )

  assert.deepEqual(report, {
    urls: [`http://192.168.1.20:8787/clips/${key}.mp4`],
    expiresAt: new Date(now + MAX_LOCAL_PLAYBACK_TTL_MS).toISOString(),
  })
})

test("reports with no usable links or already expired are ignored", () => {
  assert.equal(
    sanitizeLocalPlaybackReport(
      { urls: [`http://8.8.8.8/clips/${key}.mp4`], expiresAt: new Date(now + 60_000).toISOString() },
      now,
    ),
    null,
  )
  assert.equal(
    sanitizeLocalPlaybackReport(
      { urls: [`http://192.168.1.20/clips/${key}.mp4`], expiresAt: new Date(now - 1).toISOString() },
      now,
    ),
    null,
  )
})

test("expired links are no longer handed to the TV", () => {
  const playback = { urls: ["x"], expiresAt: new Date(now + 1_000).toISOString() }
  assert.equal(activeLocalPlayback(playback, now), playback)
  assert.equal(activeLocalPlayback(playback, now + 1_000), null)
  assert.equal(activeLocalPlayback(null, now), null)
})
