import { TT_STANDARD_RULESET } from "../catalog/constants.ts"

export class SportRulesError extends Error {
  constructor(message) {
    super(message)
    this.name = "SportRulesError"
  }
}

const DEFAULT_CONFIG = {
  gamesToWin: 3,
  pointsToWin: 11,
  winBy: 2,
  initialServer: "a",
}

function assertNonNegative(value, label) {
  if (value < 0) {
    throw new SportRulesError(`${label} cannot be negative.`)
  }
}

function flipSide(side) {
  return side === "a" ? "b" : "a"
}

function gameOpeningServer(initialServer, gamesA, gamesB) {
  const completedGames = gamesA + gamesB
  return completedGames % 2 === 0 ? initialServer : flipSide(initialServer)
}

function computeServer(pointsA, pointsB, openingServer) {
  const totalPoints = pointsA + pointsB
  if (totalPoints === 0) {
    return openingServer
  }

  const deuce = pointsA >= 10 && pointsB >= 10
  const interval = deuce ? 1 : 2
  const rotations = Math.floor(totalPoints / interval)
  return rotations % 2 === 0 ? openingServer : flipSide(openingServer)
}

function gameWinner(pointsA, pointsB, pointsToWin, winBy) {
  if (pointsA >= pointsToWin && pointsA - pointsB >= winBy) {
    return "a"
  }
  if (pointsB >= pointsToWin && pointsB - pointsA >= winBy) {
    return "b"
  }
  return null
}

function matchWinner(gamesA, gamesB, gamesToWin) {
  if (gamesA >= gamesToWin) {
    return "a"
  }
  if (gamesB >= gamesToWin) {
    return "b"
  }
  return null
}

function applyPointDelta(state, side, delta) {
  if (state.matchStatus === "completed") {
    throw new SportRulesError("Match is already completed.")
  }

  if (delta === 0) {
    throw new SportRulesError("Score delta must be non-zero.")
  }

  let pointsA = state.pointsA
  let pointsB = state.pointsB
  let gamesA = state.gamesA
  let gamesB = state.gamesB
  let matchStatus =
    state.matchStatus === "not_started" ? "in_progress" : state.matchStatus

  if (side === "a") {
    pointsA += delta
  } else {
    pointsB += delta
  }

  assertNonNegative(pointsA, "Player A points")
  assertNonNegative(pointsB, "Player B points")

  const winner = gameWinner(pointsA, pointsB, state.pointsToWin, state.winBy)

  if (winner) {
    if (winner === "a") {
      gamesA += 1
    } else {
      gamesB += 1
    }
    pointsA = 0
    pointsB = 0
  }

  const matchSide = matchWinner(gamesA, gamesB, state.gamesToWin)
  if (matchSide) {
    matchStatus = "completed"
  }

  const server = computeServer(
    pointsA,
    pointsB,
    gameOpeningServer(state.initialServer, gamesA, gamesB),
  )

  return {
    ...state,
    matchStatus,
    gamesA,
    gamesB,
    pointsA,
    pointsB,
    server,
  }
}

export const ttStandardV1Adapter = {
  ruleset: TT_STANDARD_RULESET,

  validateConfig(config) {
    if (config.ruleset !== TT_STANDARD_RULESET) {
      throw new SportRulesError(`Expected ${TT_STANDARD_RULESET}.`)
    }
  },

  initialState(config) {
    this.validateConfig(config)

    return {
      ruleset: TT_STANDARD_RULESET,
      matchStatus: "not_started",
      gamesA: 0,
      gamesB: 0,
      pointsA: 0,
      pointsB: 0,
      initialServer: config.initialServer ?? DEFAULT_CONFIG.initialServer,
      server: config.initialServer ?? DEFAULT_CONFIG.initialServer,
      gamesToWin: config.gamesToWin ?? DEFAULT_CONFIG.gamesToWin,
      pointsToWin: config.pointsToWin ?? DEFAULT_CONFIG.pointsToWin,
      winBy: config.winBy ?? DEFAULT_CONFIG.winBy,
    }
  },

  applyEvent(state, event) {
    if (event.kind === "point" && event.delta <= 0) {
      throw new SportRulesError("Point events require a positive delta.")
    }

    if (event.kind === "correction" && event.delta >= 0) {
      throw new SportRulesError("Correction events require a negative delta.")
    }

    return applyPointDelta(state, event.side, event.delta)
  },
}
