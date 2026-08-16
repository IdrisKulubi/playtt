import assert from "node:assert/strict"
import test from "node:test"

import {
  processReplayReadyCallback,
  REPLAY_TITLE_MAX_LENGTH,
  REPLAY_VIDEO_URL_MAX_LENGTH,
  verifyReplayReadySecret,
} from "./ready-callback.ts"

const configuredSecret = "replay-secret-✓"

function createMarker() {
  const calls = []
  return {
    calls,
    markReady: async (payload) => {
      calls.push(payload)
      return {
        id: payload.replayId,
        status: "ready",
        videoUrl: payload.videoUrl,
      }
    },
  }
}

function process(input = {}) {
  const { marker: providedMarker, ...overrides } = input
  const marker = providedMarker ?? createMarker()
  return {
    marker,
    result: processReplayReadyCallback({
      configuredSecret,
      markReady: marker.markReady,
      providedSecret: configuredSecret,
      rawBody: JSON.stringify({
        videoUrl: "https://media.example.test/replay.mp4",
      }),
      replayId: "replay-1",
      ...overrides,
    }),
  }
}

test("shared-secret verification supports UTF-8 and rejects unequal values", () => {
  assert.equal(
    verifyReplayReadySecret({
      configuredSecret,
      providedSecret: configuredSecret,
    }),
    true
  )
  assert.equal(
    verifyReplayReadySecret({
      configuredSecret,
      providedSecret: "replay-secret-x",
    }),
    false
  )
  assert.equal(
    verifyReplayReadySecret({ configuredSecret, providedSecret: null }),
    false
  )
})

for (const missingSecret of [undefined, "", "   "]) {
  test("missing configured secret fails closed without marking ready", async () => {
    const { marker, result } = process({ configuredSecret: missingSecret })

    assert.deepEqual(await result, {
      body: {
        code: "REPLAY_CALLBACK_UNAVAILABLE",
        message: "Replay callback is temporarily unavailable.",
      },
      status: 503,
    })
    assert.deepEqual(marker.calls, [])
  })
}

for (const providedSecret of [null, "", "wrong-secret"]) {
  test("missing or invalid provided secret returns generic 401", async () => {
    const { marker, result } = process({
      providedSecret,
      rawBody: "not-json",
    })

    assert.deepEqual(await result, {
      body: {
        code: "UNAUTHORIZED",
        message: "Invalid replay webhook secret.",
      },
      status: 401,
    })
    assert.deepEqual(marker.calls, [])
  })
}

test("authenticated malformed JSON returns stable 400 without marking ready", async () => {
  const { marker, result } = process({ rawBody: "{not-json" })

  assert.deepEqual(await result, {
    body: { code: "INVALID_BODY", message: "Invalid request body." },
    status: 400,
  })
  assert.deepEqual(marker.calls, [])
})

for (const payload of [
  null,
  {},
  { videoUrl: "http://media.example.test/replay.mp4" },
  { videoUrl: "https://user:password@media.example.test/replay.mp4" },
  {
    videoUrl: `https://media.example.test/${"a".repeat(REPLAY_VIDEO_URL_MAX_LENGTH)}`,
  },
  { videoUrl: "https://media.example.test/replay.mp4", title: 42 },
  {
    videoUrl: "https://media.example.test/replay.mp4",
    title: "a".repeat(REPLAY_TITLE_MAX_LENGTH + 1),
  },
]) {
  test("invalid callback payload returns stable 400 without marking ready", async () => {
    const { marker, result } = process({ rawBody: JSON.stringify(payload) })

    assert.deepEqual(await result, {
      body: {
        code: "VALIDATION_ERROR",
        message: "Invalid replay callback payload.",
      },
      status: 400,
    })
    assert.deepEqual(marker.calls, [])
  })
}

test("valid callback trims payload, marks ready once, and preserves success envelope", async () => {
  const { marker, result } = process({
    rawBody: JSON.stringify({
      title: "  Match point  ",
      videoUrl: "  https://media.example.test/replay.mp4?token=example  ",
    }),
  })

  assert.deepEqual(await result, {
    body: {
      data: {
        replay: {
          id: "replay-1",
          status: "ready",
          videoUrl: "https://media.example.test/replay.mp4?token=example",
        },
      },
    },
    status: 200,
  })
  assert.deepEqual(marker.calls, [
    {
      replayId: "replay-1",
      title: "Match point",
      videoUrl: "https://media.example.test/replay.mp4?token=example",
    },
  ])
})

test("blank optional title is normalized to undefined", async () => {
  const { marker, result } = process({
    rawBody: JSON.stringify({
      title: "   ",
      videoUrl: "https://media.example.test/replay.mp4",
    }),
  })

  assert.equal((await result).status, 200)
  assert.equal(marker.calls.length, 1)
  assert.equal(marker.calls[0].title, undefined)
})

test("mark-ready rejection propagates after one call", async () => {
  const internalError = new Error("database failed")
  let calls = 0

  const { result } = process({
    marker: {
      calls: [],
      markReady: async () => {
        calls += 1
        throw internalError
      },
    },
  })

  await assert.rejects(result, internalError)
  assert.equal(calls, 1)
})
