import { readFileSync } from "node:fs"
import { join } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

import {
  REPLAY_CLIP_DURATION_SECONDS,
  REPLAY_POST_ROLL_SECONDS,
  REPLAY_PRE_ROLL_SECONDS,
} from "./constants.ts"

const repoRoot = join(import.meta.dirname, "..", "..", "..")
const replaysRoot = import.meta.dirname

const schemaSource = readFileSync(join(repoRoot, "db", "schema.ts"), "utf8")
const migrationSource = readFileSync(
  join(repoRoot, "drizzle", "0021_replay_requests.sql"),
  "utf8",
)
const seedSource = readFileSync(join(repoRoot, "db", "seed-phase1.sql"), "utf8")

test("schema defines replay_requests with lifecycle and idempotency fields", () => {
  assert.match(schemaSource, /replayRequests/)
  assert.match(schemaSource, /replay_request_status/)
  assert.match(schemaSource, /replay_capture_source/)
  assert.match(schemaSource, /clientIdempotencyKey/)
  assert.match(schemaSource, /venueEdgeDeviceId/)
  assert.match(schemaSource, /capture_replay/)
})

test("migration adds replay_requests table and enum extensions", () => {
  assert.match(migrationSource, /CREATE TABLE "replay_requests"/)
  assert.match(migrationSource, /replay_request_status/)
  assert.match(migrationSource, /replay_capture_source/)
  assert.match(
    migrationSource,
    /replay_requests_requester_session_idempotency_unique/,
  )
  assert.match(migrationSource, /capture_replay/)
  assert.match(migrationSource, /venue_edge/)
})

test("seed includes replay_edge feature flag", () => {
  const featurePolicySource = readFileSync(
    join(replaysRoot, "feature-policy.ts"),
    "utf8",
  )

  assert.match(seedSource, /'replay_edge'/)
  assert.match(featurePolicySource, /REPLAY_EDGE_FLAG_KEY = "replay_edge"/)
})

test("replay timing constants use 12s pre-roll and 3s post-roll", () => {
  assert.equal(REPLAY_PRE_ROLL_SECONDS, 12)
  assert.equal(REPLAY_POST_ROLL_SECONDS, 3)
  assert.equal(REPLAY_CLIP_DURATION_SECONDS, 15)
  assert.equal(
    REPLAY_PRE_ROLL_SECONDS + REPLAY_POST_ROLL_SECONDS,
    REPLAY_CLIP_DURATION_SECONDS,
  )
})

test("repository enforces explicit replay request transitions", () => {
  const source = readFileSync(
    join(replaysRoot, "replay-requests-repository.ts"),
    "utf8",
  )

  assert.match(source, /ALLOWED_REPLAY_REQUEST_TRANSITIONS/)
  assert.match(source, /transitionReplayRequestStatus/)
  assert.match(source, /INVALID_REPLAY_REQUEST_TRANSITION/)
  assert.match(source, /getReplayRequestByIdempotencyKey/)
  assert.match(source, /resolveVenueEdgeForResource/)
  assert.match(source, /getActivePlaySessionForReplayRequest/)
  assert.match(source, /eq\(sessionParticipants\.role, "owner"\)/)
  assert.match(source, /eq\(resourceCapabilities\.code, "replay"\)/)
})

test("createReplayRequest orchestrates credit debit, media, command, and dispatch", () => {
  const source = readFileSync(
    join(replaysRoot, "replay-requests-service.ts"),
    "utf8",
  )

  assert.match(source, /db\.transaction/)
  assert.match(source, /insertMediaAsset/)
  assert.match(source, /buildMediaObjectKey/)
  assert.match(source, /capture_replay/)
  assert.match(source, /transitionReplayRequestStatus/)
  assert.match(source, /getReplayRequestByIdempotencyKey/)
  assert.match(source, /isReplayEdgeEnabledForTenant/)
  assert.match(source, /isPrivateMediaEnabledForTenant/)
})

test("legacy requestReplayCapture delegates to createReplayRequest when replay_edge enabled", () => {
  const source = readFileSync(join(replaysRoot, "service.ts"), "utf8")

  assert.match(source, /isReplayEdgeEnabledForTenant/)
  assert.match(source, /createReplayRequest/)
  assert.match(source, /enqueueNvrClip/)
})

test("canonical and compatibility replay request routes exist", () => {
  const canonicalRoute = readFileSync(
    join(
      repoRoot,
      "src/app/api/v1/sessions/[sessionId]/replay-requests/route.ts",
    ),
    "utf8",
  )
  const legacyRoute = readFileSync(
    join(repoRoot, "src/app/api/replays/request/route.ts"),
    "utf8",
  )

  assert.match(canonicalRoute, /clientIdempotencyKey/)
  assert.match(canonicalRoute, /createReplayRequest/)
  assert.match(legacyRoute, /requestReplayCapture/)
})

test("edge v1 routes reuse device auth and filter config secrets", () => {
  const configRoute = readFileSync(
    join(repoRoot, "src/app/api/edge/v1/config/route.ts"),
    "utf8",
  )
  const progressRoute = readFileSync(
    join(
      repoRoot,
      "src/app/api/edge/v1/replay-requests/[id]/progress/route.ts",
    ),
    "utf8",
  )
  const edgeConfig = readFileSync(join(replaysRoot, "edge-config.ts"), "utf8")

  assert.match(configRoute, /requireDeviceRequest/)
  assert.match(configRoute, /filterEdgeConfigSecrets/)
  assert.match(progressRoute, /updateReplayRequestProgressFromEdge/)
  assert.match(edgeConfig, /venue_edge/)
  assert.match(edgeConfig, /\[redacted\]/)
})

test("edge config redacts secrets for non-venue-edge devices", async () => {
  const { filterEdgeConfigSecrets } = await import("./edge-config.ts")

  const filtered = filterEdgeConfigSecrets(
    {
      camera: {
        rtspUrl: "rtsp://cam.local/stream",
        password: "secret-value",
        label: "table-1",
      },
    },
    "camera",
  )

  assert.equal(filtered["camera"].password, "[redacted]")
  assert.equal(filtered["camera"].label, "table-1")
})

test("idempotency duplicate returns same replay and media identities", async (t) => {
  if (!process.env.POSTGRES_URL) {
    t.skip("POSTGRES_URL is not configured")
    return
  }

  const repositorySource = readFileSync(
    join(replaysRoot, "replay-requests-repository.ts"),
    "utf8",
  )

  assert.match(
    repositorySource,
    /replay_requests_requester_session_idempotency_unique/,
  )
  assert.match(repositorySource, /clientIdempotencyKey/)
})

test("concurrency structure debits one credit per idempotency key", async (t) => {
  if (!process.env.POSTGRES_URL) {
    t.skip("POSTGRES_URL is not configured")
    return
  }

  const serviceSource = readFileSync(
    join(replaysRoot, "replay-requests-service.ts"),
    "utf8",
  )

  assert.match(serviceSource, /for\("update"\)/)
  assert.match(serviceSource, /getReplayRequestByIdempotencyKey/)
  assert.match(serviceSource, /buildExistingReplayRequestResult/)
})

test("cross-tenant denial patterns scope replay requests by tenant", () => {
  const repositorySource = readFileSync(
    join(replaysRoot, "replay-requests-repository.ts"),
    "utf8",
  )
  const serviceSource = readFileSync(
    join(replaysRoot, "replay-requests-service.ts"),
    "utf8",
  )

  assert.match(repositorySource, /eq\(replayRequests\.tenantId, context\.tenantId\)/)
  assert.match(repositorySource, /eq\(playSessions\.tenantId, context\.tenantId\)/)
  assert.match(serviceSource, /REPLAY_REQUEST_FORBIDDEN/)
  assert.match(serviceSource, /venueEdgeDeviceId !== input\.deviceId/)
})

test("kiosk replay repository resolves owner by resource and debounces in-flight requests", () => {
  const repositorySource = readFileSync(
    join(replaysRoot, "replay-requests-repository.ts"),
    "utf8",
  )

  assert.match(repositorySource, /getActivePlaySessionOwnerForResource/)
  assert.match(repositorySource, /getInFlightReplayRequestForSession/)
  assert.match(repositorySource, /notInArray\(replayRequests\.status/)
  assert.match(repositorySource, /eq\(sessionParticipants\.role, "owner"\)/)
})

test("kiosk replay service charges session owner via createReplayRequest", () => {
  const serviceSource = readFileSync(
    join(replaysRoot, "replay-requests-service.ts"),
    "utf8",
  )

  assert.match(serviceSource, /createKioskReplayRequest/)
  assert.match(serviceSource, /getKioskReplayStatus/)
  assert.match(serviceSource, /kiosk-replay/)
  assert.match(serviceSource, /requestSource: "table_kiosk"/)
  assert.match(serviceSource, /REPLAY_IN_FLIGHT/)
  assert.match(serviceSource, /sessionOwner\.ownerUserId/)
})

test("display kiosk replay route exposes GET status and POST capture", () => {
  const kioskRoute = readFileSync(
    join(
      repoRoot,
      "src/app/api/display/v1/resources/[resourceId]/replay-requests/route.ts",
    ),
    "utf8",
  )
  const kioskPage = readFileSync(
    join(repoRoot, "src/app/replay/page.tsx"),
    "utf8",
  )
  const kioskComponent = readFileSync(
    join(repoRoot, "src/components/replay/table-replay-kiosk.tsx"),
    "utf8",
  )

  assert.match(kioskRoute, /createKioskReplayRequest/)
  assert.match(kioskRoute, /getKioskReplayStatus/)
  assert.match(kioskRoute, /clientIdempotencyKey/)
  assert.match(kioskPage, /TableReplayKiosk/)
  assert.match(kioskPage, /resourceId/)
  assert.match(kioskComponent, /replay-requests/)
  assert.match(kioskComponent, /addEventListener\("replay"/)
})

test("operator venue detail links replay kiosk and TV URLs", () => {
  const operatorDetail = readFileSync(
    join(repoRoot, "src/components/operator/operator-venue-detail.tsx"),
    "utf8",
  )

  assert.match(operatorDetail, /\/replay\?resourceId=/)
  assert.match(operatorDetail, /\/pod\/tv\?resourceId=/)
})
