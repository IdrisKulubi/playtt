import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { TT_STANDARD_RULESET } from "../catalog/constants.ts"
import { ttStandardV1Adapter } from "./tt-standard-v1-core.mjs"
import {
  gamesToWinForBestOf,
  hasMatch,
  matchWinnerOf,
  MatchSetupError,
  parseMatchSetup,
  pointCueFor,
  stateForEndedMatch,
  stateForStartedMatch,
} from "./match-setup.ts"

const repoRoot = join(import.meta.dirname, "..", "..", "..")
const initial = () => ttStandardV1Adapter.initialState({ ruleset: TT_STANDARD_RULESET })
const point = (state, side) =>
  ttStandardV1Adapter.applyEvent(state, { kind: "point", side, delta: 1 })

test("singles setup takes one trimmed name per side", () => {
  const setup = parseMatchSetup(
    { mode: "singles", sideA: ["  Amina  "], sideB: ["Brian"], bestOf: 5 },
    new Date("2026-11-26T10:00:00Z"),
  )
  assert.deepEqual(setup.sides, { a: ["Amina"], b: ["Brian"] })
  assert.equal(setup.bestOf, 5)
  assert.equal(setup.startedAt, "2026-11-26T10:00:00.000Z")
})

test("doubles setup needs two names per side", () => {
  const setup = parseMatchSetup({
    mode: "doubles",
    sideA: ["Amina", "Chen"],
    sideB: ["Brian", "Dee"],
    bestOf: 3,
  })
  assert.deepEqual(setup.sides.a, ["Amina", "Chen"])
  assert.throws(
    () => parseMatchSetup({ mode: "doubles", sideA: ["Amina", " "], sideB: ["B", "D"], bestOf: 3 }),
    MatchSetupError,
  )
})

test("setup rejects unknown modes, best-of values and missing names", () => {
  assert.throws(() => parseMatchSetup({ mode: "triples", sideA: ["a"], sideB: ["b"], bestOf: 3 }), MatchSetupError)
  assert.throws(() => parseMatchSetup({ mode: "singles", sideA: ["a"], sideB: ["b"], bestOf: 4 }), MatchSetupError)
  assert.throws(() => parseMatchSetup({ mode: "singles", sideA: [], sideB: ["b"], bestOf: 3 }), MatchSetupError)
  assert.throws(() => parseMatchSetup({ mode: "singles", sideA: "a", sideB: ["b"], bestOf: 3 }), MatchSetupError)
})

test("names are capped so they fit the TV corners", () => {
  const setup = parseMatchSetup({ mode: "singles", sideA: ["x".repeat(60)], sideB: ["b"], bestOf: 3 })
  assert.equal(setup.sides.a[0].length, 20)
})

test("best of N maps to games to win", () => {
  assert.equal(gamesToWinForBestOf(3), 2)
  assert.equal(gamesToWinForBestOf(5), 3)
  assert.equal(gamesToWinForBestOf(7), 4)
})

test("a started match keeps its setup through ESP32 points", () => {
  const setup = parseMatchSetup({ mode: "singles", sideA: ["A"], sideB: ["B"], bestOf: 3 })
  let state = stateForStartedMatch(initial(), setup)
  assert.equal(state.gamesToWin, 2)
  assert.equal(hasMatch(state), true)
  state = point(state, "a")
  assert.deepEqual(state.setup, setup)
  assert.equal(state.matchStatus, "in_progress")
})

test("an ended match clears the table", () => {
  const ended = stateForEndedMatch(initial())
  assert.equal(ended.setup, null)
  assert.equal(hasMatch(ended), false)
  assert.equal(hasMatch(point(initial(), "b")), true)
})

test("game point and match point cues", () => {
  const setup = parseMatchSetup({ mode: "singles", sideA: ["A"], sideB: ["B"], bestOf: 3 })
  let state = stateForStartedMatch(initial(), setup)
  for (let i = 0; i < 10; i += 1) state = point(state, "a")
  assert.equal(pointCueFor(state, "a"), "game")
  assert.equal(pointCueFor(state, "b"), null)
  state = point(state, "a") // A wins game 1
  for (let i = 0; i < 10; i += 1) state = point(state, "a")
  assert.equal(pointCueFor(state, "a"), "match")
  state = point(state, "a")
  assert.equal(state.matchStatus, "completed")
  assert.equal(matchWinnerOf(state), "a")
  assert.equal(pointCueFor(state, "a"), null)
})

test("deuce is not game point until one side leads", () => {
  let state = initial()
  for (let i = 0; i < 10; i += 1) {
    state = point(state, "a")
    state = point(state, "b")
  }
  assert.equal(pointCueFor(state, "a"), null)
  state = point(state, "a")
  assert.equal(pointCueFor(state, "a"), "game")
})

test("tablet match route uses the match control service", () => {
  const route = readFileSync(
    join(repoRoot, "src/app/api/display/v1/resources/[resourceId]/match/route.ts"),
    "utf8",
  )
  assert.match(route, /startTableMatch/)
  assert.match(route, /endTableMatch/)
})
