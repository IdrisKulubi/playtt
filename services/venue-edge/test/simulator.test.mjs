import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

import {
  PROTOCOL_FIXTURE_COMMAND,
  createMinimalMp4Fixture,
} from "../src/simulator/fixtures.ts"
import { loadEnv } from "../src/config/env.ts"
import { initDatabase } from "../src/state/sqlite.ts"
import { EdgeRepositories } from "../src/local-storage/repositories.ts"
import { createLocalStoragePaths } from "../src/local-storage/paths.ts"
import { ReplayOrchestrator } from "../src/replay/orchestrator.ts"
import { resumeUnfinishedJobs } from "../src/recovery/resume.ts"
import { CommandProcessor } from "../src/commands/processor.ts"

test("simulator processes capture_replay through ready with SQLite persistence", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "venue-edge-sim-"))
  const env = loadEnv({
    mode: "simulate",
    dataDir,
    cloudBaseUrl: "http://mock.local",
    sqlitePath: join(dataDir, "venue-edge.sqlite"),
  })

  const progress = []
  const uploads = []

  const fetchImpl = async (url, init) => {
    const parsed = new URL(url)

    if (parsed.pathname.endsWith("/progress")) {
      const body = JSON.parse(String(init?.body))
      progress.push(body.status)
      return new Response(JSON.stringify({ data: {} }), { status: 200 })
    }

    if (parsed.pathname.endsWith("/ack")) {
      return new Response(JSON.stringify({ data: { command: {} } }), {
        status: 200,
      })
    }

    if (parsed.pathname.includes("/upload-url")) {
      uploads.push(parsed.pathname)
      return new Response(
        JSON.stringify({
          data: {
            uploadGrant: {
              url: "https://r2.example/upload",
              expiresAt: new Date(Date.now() + 60_000).toISOString(),
            },
          },
        }),
        { status: 200 },
      )
    }

    return new Response(JSON.stringify({ data: {} }), { status: 200 })
  }

  const database = initDatabase(env.sqlitePath)
  const repositories = new EdgeRepositories(database.db)
  const paths = createLocalStoragePaths(env)

  const edgeConfig = {
    configVersion: 1,
    resourceId: PROTOCOL_FIXTURE_COMMAND.payload.resourceId,
    role: "venue_edge",
    assignment: {
      id: "assignment-1",
      locationId: "location-1",
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      effectiveTo: null,
    },
    config: {},
  }

  const client = new (await import("../src/cloud/client.ts")).EdgeV1Client({
    baseUrl: env.cloudBaseUrl,
    deviceId: "device-1",
    secret: "secret-1",
    fetchImpl: fetchImpl,
  })

  const orchestrator = new ReplayOrchestrator({
    env,
    client,
    repositories,
    paths,
    getEdgeConfig: () => edgeConfig,
    fetchImpl: fetchImpl,
  })

  await orchestrator.processCaptureReplay(
    PROTOCOL_FIXTURE_COMMAND.id,
    PROTOCOL_FIXTURE_COMMAND.payload,
  )

  const job = repositories.getReplayJob(
    PROTOCOL_FIXTURE_COMMAND.payload.replayRequestId,
  )

  assert.equal(job?.status, "ready")
  assert.deepEqual(progress, [
    "edge_acknowledged",
    "capturing",
    "extracting",
    "uploading",
    "verifying",
    "ready",
  ])

  database.close()
  await rm(dataDir, { recursive: true, force: true })
})

test("restart resumes unfinished replay job from SQLite", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "venue-edge-resume-"))
  const env = loadEnv({
    mode: "simulate",
    dataDir,
    cloudBaseUrl: "http://mock.local",
    sqlitePath: join(dataDir, "venue-edge.sqlite"),
  })

  const progress = []

  const fetchImpl = async (url, init) => {
    const parsed = new URL(url)

    if (parsed.pathname.endsWith("/progress")) {
      const body = JSON.parse(String(init?.body))
      progress.push(body.status)
      return new Response(JSON.stringify({ data: {} }), { status: 200 })
    }

    if (parsed.pathname.endsWith("/ack")) {
      return new Response(JSON.stringify({ data: { command: {} } }), {
        status: 200,
      })
    }

    if (parsed.pathname.includes("/upload-url")) {
      return new Response(
        JSON.stringify({
          data: {
            uploadGrant: {
              url: "https://r2.example/upload",
              expiresAt: new Date(Date.now() + 60_000).toISOString(),
            },
          },
        }),
        { status: 200 },
      )
    }

    return new Response(JSON.stringify({ data: {} }), { status: 200 })
  }

  const database = initDatabase(env.sqlitePath)
  const repositories = new EdgeRepositories(database.db)
  const paths = createLocalStoragePaths(env)

  repositories.upsertCommand({
    id: "cmd-resume-1",
    kind: "capture_replay",
    payload: PROTOCOL_FIXTURE_COMMAND.payload,
    correlationId: "corr-1",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    attemptCount: 1,
  })

  const clipPath = join(dataDir, "pending", "clip.mp4")
  await mkdir(join(dataDir, "pending"), { recursive: true })
  await writeFile(clipPath, createMinimalMp4Fixture("resume"))

  repositories.createReplayJob({
    commandId: "cmd-resume-1",
    payload: PROTOCOL_FIXTURE_COMMAND.payload,
    status: "uploading",
  })

  repositories.updateReplayJob(
    PROTOCOL_FIXTURE_COMMAND.payload.replayRequestId,
    { localClipPath: clipPath },
  )

  const edgeConfig = {
    configVersion: 1,
    resourceId: PROTOCOL_FIXTURE_COMMAND.payload.resourceId,
    role: "venue_edge",
    assignment: {
      id: "assignment-1",
      locationId: "location-1",
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      effectiveTo: null,
    },
    config: {},
  }

  const client = new (await import("../src/cloud/client.ts")).EdgeV1Client({
    baseUrl: env.cloudBaseUrl,
    deviceId: "device-1",
    secret: "secret-1",
    fetchImpl: fetchImpl,
  })

  const orchestrator = new ReplayOrchestrator({
    env,
    client,
    repositories,
    paths,
    getEdgeConfig: () => edgeConfig,
    fetchImpl: fetchImpl,
  })

  const resumed = await resumeUnfinishedJobs({
    repositories,
    orchestrator,
  })

  assert.equal(resumed, 1)
  assert.ok(progress.includes("uploading"))
  assert.ok(progress.includes("ready"))

  database.close()
  await rm(dataDir, { recursive: true, force: true })
})

test("duplicate command idempotency does not re-run completed job", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "venue-edge-dup-"))
  const env = loadEnv({
    mode: "simulate",
    dataDir,
    cloudBaseUrl: "http://mock.local",
    sqlitePath: join(dataDir, "venue-edge.sqlite"),
  })

  let progressCount = 0

  const fetchImpl = async (url, init) => {
    const parsed = new URL(url)

    if (parsed.pathname.endsWith("/progress")) {
      progressCount += 1
      return new Response(JSON.stringify({ data: {} }), { status: 200 })
    }

    if (parsed.pathname.endsWith("/ack")) {
      return new Response(JSON.stringify({ data: { command: {} } }), {
        status: 200,
      })
    }

    return new Response(JSON.stringify({ data: {} }), { status: 200 })
  }

  const database = initDatabase(env.sqlitePath)
  const repositories = new EdgeRepositories(database.db)
  const paths = createLocalStoragePaths(env)

  const edgeConfig = {
    configVersion: 1,
    resourceId: PROTOCOL_FIXTURE_COMMAND.payload.resourceId,
    role: "venue_edge",
    assignment: {
      id: "assignment-1",
      locationId: "location-1",
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      effectiveTo: null,
    },
    config: {},
  }

  const client = new (await import("../src/cloud/client.ts")).EdgeV1Client({
    baseUrl: env.cloudBaseUrl,
    deviceId: "device-1",
    secret: "secret-1",
    fetchImpl: fetchImpl,
  })

  const orchestrator = new ReplayOrchestrator({
    env,
    client,
    repositories,
    paths,
    getEdgeConfig: () => edgeConfig,
    fetchImpl: fetchImpl,
  })

  const processor = new CommandProcessor(
    client,
    repositories,
    orchestrator,
    () => edgeConfig,
    () => null,
  )

  repositories.upsertCommand({
    id: PROTOCOL_FIXTURE_COMMAND.id,
    kind: "capture_replay",
    payload: PROTOCOL_FIXTURE_COMMAND.payload,
    correlationId: PROTOCOL_FIXTURE_COMMAND.correlationId,
    expiresAt: PROTOCOL_FIXTURE_COMMAND.expiresAt,
    attemptCount: 1,
  })

  repositories.createReplayJob({
    commandId: PROTOCOL_FIXTURE_COMMAND.id,
    payload: PROTOCOL_FIXTURE_COMMAND.payload,
    status: "ready",
  })

  repositories.updateCommandStatus(PROTOCOL_FIXTURE_COMMAND.id, "acknowledged")

  const handled = await processor.handleCommand(PROTOCOL_FIXTURE_COMMAND)
  assert.equal(handled, false)
  assert.equal(progressCount, 0)

  database.close()
  await rm(dataDir, { recursive: true, force: true })
})
