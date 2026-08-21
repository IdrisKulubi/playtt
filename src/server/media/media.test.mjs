import { readFileSync } from "node:fs"
import { join } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

import { PRIVATE_MEDIA_FLAG_KEY } from "./access.mjs"
import {
  MEDIA_CONTENT_TYPES,
  MEDIA_SIZE_LIMITS,
} from "./constants.ts"
import {
  assertFakeMediaStoreAllowed,
  shouldAllowFakeMediaStore,
} from "./stub-policy.ts"

const repoRoot = join(import.meta.dirname, "..", "..", "..")
const mediaRoot = import.meta.dirname

const schemaSource = readFileSync(join(repoRoot, "db", "schema.ts"), "utf8")
const migrationSource = readFileSync(
  join(repoRoot, "drizzle", "0020_media_assets.sql"),
  "utf8",
)
const seedSource = readFileSync(join(repoRoot, "db", "seed-phase1.sql"), "utf8")
const objectKeysSource = readFileSync(join(mediaRoot, "object-keys.ts"), "utf8")
const fakeAdapterSource = readFileSync(join(mediaRoot, "fake-adapter.ts"), "utf8")
const contentPolicySource = readFileSync(join(mediaRoot, "content-policy.ts"), "utf8")

test("schema defines tenant-scoped media tables and replay linkage", () => {
  assert.match(schemaSource, /mediaAssets/)
  assert.match(schemaSource, /mediaEventInbox/)
  assert.match(schemaSource, /mediaAssetId/)
  assert.match(schemaSource, /media_kind/)
  assert.match(schemaSource, /media_status/)
})

test("migration adds media tables and replay media_asset_id", () => {
  assert.match(migrationSource, /CREATE TABLE "media_assets"/)
  assert.match(migrationSource, /CREATE TABLE "media_event_inbox"/)
  assert.match(migrationSource, /ADD COLUMN "media_asset_id"/)
  assert.match(migrationSource, /media_assets_tenant_play_session_fk/)
})

test("seed includes private_media feature flag", () => {
  assert.match(seedSource, /'private_media'/)
  assert.equal(PRIVATE_MEDIA_FLAG_KEY, "private_media")
})

test("object keys are generated server-side with immutable replay path", () => {
  assert.match(objectKeysSource, /buildMediaObjectKey/)
  assert.match(objectKeysSource, /source\.mp4/)
  assert.match(objectKeysSource, /buildMediaPrefix/)
})

test("content policy maps kinds to exact MIME and size limits", () => {
  assert.match(contentPolicySource, /MEDIA_CONTENT_TYPES/)
  assert.match(contentPolicySource, /MEDIA_SIZE_LIMITS/)
  assert.match(contentPolicySource, /isLegacyReplayUrl/)
  assert.equal(MEDIA_CONTENT_TYPES.source_video, "video/mp4")
  assert.equal(MEDIA_SIZE_LIMITS.source_video, 200 * 1024 * 1024)
})

test("fake media store adapter exposes exact-key grant contract", () => {
  assert.match(fakeAdapterSource, /createUploadGrant/)
  assert.match(fakeAdapterSource, /createDownloadGrant/)
  assert.match(fakeAdapterSource, /headObject/)
  assert.match(fakeAdapterSource, /deleteObject/)
  assert.match(fakeAdapterSource, /listPrefix/)
  assert.match(fakeAdapterSource, /Fake MediaStore outage/)
})

test("production blocks fake media store driver", () => {
  assert.equal(
    shouldAllowFakeMediaStore({ environment: "production", driver: "fake" }),
    false,
  )
  assert.throws(
    () => assertFakeMediaStoreAllowed("production"),
    /disabled in production/,
  )
})

test("media v1 routes exist and require authenticated tenant context", () => {
  const createRoute = readFileSync(
    join(repoRoot, "src/app/api/v1/media/route.ts"),
    "utf8",
  )
  const uploadRoute = readFileSync(
    join(
      repoRoot,
      "src/app/api/v1/media/[mediaId]/upload-url/route.ts",
    ),
    "utf8",
  )
  const downloadRoute = readFileSync(
    join(
      repoRoot,
      "src/app/api/v1/media/[mediaId]/download-url/route.ts",
    ),
    "utf8",
  )
  const completeRoute = readFileSync(
    join(repoRoot, "src/app/api/v1/media/[mediaId]/complete/route.ts"),
    "utf8",
  )
  const deleteRoute = readFileSync(
    join(repoRoot, "src/app/api/v1/media/[mediaId]/route.ts"),
    "utf8",
  )

  assert.match(createRoute, /getSessionWithBearerFallback/)
  assert.match(createRoute, /createMediaAssetForSession/)
  assert.match(uploadRoute, /issueMediaUploadGrant/)
  assert.match(downloadRoute, /issueMediaDownloadGrant/)
  assert.match(completeRoute, /completeMediaUpload/)
  assert.match(deleteRoute, /requestMediaDeletion/)
})

test("service authorizes by metadata owner before issuing grants", () => {
  const serviceSource = readFileSync(join(mediaRoot, "service.ts"), "utf8")
  assert.match(serviceSource, /getAuthorizedMediaAsset/)
  assert.match(serviceSource, /ownerUserId: input.userId/)
  assert.match(serviceSource, /insertMediaEventInbox/)
})

test("durable work registers media delete consumer and reconciliation", () => {
  const durableWork = readFileSync(
    join(repoRoot, "src/server/workers/run-durable-work.ts"),
    "utf8",
  )
  assert.match(durableWork, /createMediaDeleteConsumers/)
  assert.match(durableWork, /reconcileMediaStorage/)
})

test("replay list dual-reads private media when enabled", () => {
  const replayService = readFileSync(
    join(repoRoot, "src/server/replays/service.ts"),
    "utf8",
  )
  assert.match(replayService, /isPrivateMediaEnabledForTenant/)
  assert.match(replayService, /createPlaybackGrantForMediaAsset/)
  assert.match(replayService, /isLegacyReplayUrl/)
})

test("media factory defaults to fake without R2 env", () => {
  const factorySource = readFileSync(join(mediaRoot, "factory.ts"), "utf8")
  assert.match(factorySource, /MEDIA_STORE_DRIVER/)
  assert.match(factorySource, /createFakeMediaStore/)
  assert.match(factorySource, /createR2MediaStore/)
  assert.match(factorySource, /assertFakeMediaStoreAllowed/)
})

test("r2 security documentation exists", () => {
  const doc = readFileSync(
    join(repoRoot, "docs/platform/r2-security.md"),
    "utf8",
  )
  assert.match(doc, /private buckets/)
  assert.match(doc, /private_media/)
})
