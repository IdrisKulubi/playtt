import assert from "node:assert/strict"
import test from "node:test"

import { TT_STANDARD_RULESET } from "../catalog/constants.ts"
import { ttStandardV1Adapter } from "./tt-standard-v1-core.mjs"

function initialState() {
  return ttStandardV1Adapter.initialState({ ruleset: TT_STANDARD_RULESET })
}

function scorePoint(state, side) {
  return ttStandardV1Adapter.applyEvent(state, {
    kind: "point",
    side,
    delta: 1,
  })
}

test("tt_standard_v1 wins a game at 11 with two clear", () => {
  let state = initialState()

  for (let i = 0; i < 10; i += 1) {
    state = scorePoint(state, "a")
  }

  assert.equal(state.pointsA, 10)
  assert.equal(state.gamesA, 0)

  state = scorePoint(state, "a")
  assert.equal(state.pointsA, 0)
  assert.equal(state.pointsB, 0)
  assert.equal(state.gamesA, 1)
  assert.equal(state.matchStatus, "in_progress")
})

test("tt_standard_v1 requires win by two at deuce", () => {
  let state = initialState()

  for (let i = 0; i < 10; i += 1) {
    state = scorePoint(state, "a")
    state = scorePoint(state, "b")
  }

  assert.equal(state.pointsA, 10)
  assert.equal(state.pointsB, 10)

  state = scorePoint(state, "a")
  state = scorePoint(state, "b")
  assert.equal(state.pointsA, 11)
  assert.equal(state.pointsB, 11)
  assert.equal(state.gamesA, 0)

  state = scorePoint(state, "a")
  state = scorePoint(state, "a")
  assert.equal(state.gamesA, 1)
})

test("tt_standard_v1 completes a best-of-five match at three games", () => {
  let state = initialState()

  for (let game = 0; game < 3; game += 1) {
    for (let i = 0; i < 11; i += 1) {
      state = scorePoint(state, "a")
    }
  }

  assert.equal(state.gamesA, 3)
  assert.equal(state.matchStatus, "completed")
})

test("tt_standard_v1 rejects scoring after completion", () => {
  let state = initialState()

  for (let game = 0; game < 3; game += 1) {
    for (let i = 0; i < 11; i += 1) {
      state = scorePoint(state, "a")
    }
  }

  assert.throws(() => scorePoint(state, "a"))
})

test("tt_standard_v1 correction undoes a point", () => {
  let state = scorePoint(initialState(), "a")
  assert.equal(state.pointsA, 1)

  state = ttStandardV1Adapter.applyEvent(state, {
    kind: "correction",
    side: "a",
    delta: -1,
  })

  assert.equal(state.pointsA, 0)
})

test("tt_standard_v1 rejects invalid deltas", () => {
  assert.throws(() =>
    ttStandardV1Adapter.applyEvent(initialState(), {
      kind: "point",
      side: "a",
      delta: -1,
    }),
  )

  assert.throws(() =>
    ttStandardV1Adapter.applyEvent(initialState(), {
      kind: "correction",
      side: "a",
      delta: 1,
    }),
  )
})
