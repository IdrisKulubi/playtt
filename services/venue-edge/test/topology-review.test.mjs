import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { createNvrPasswordStore } from "../src/auth/nvr-secret-store.ts"
import { EdgeRepositories } from "../src/local-storage/repositories.ts"
import { initDatabase } from "../src/state/sqlite.ts"
import { LocalCameraManager } from "../src/setup/local-camera-manager.ts"
import { LocalNvrManager } from "../src/setup/local-nvr-manager.ts"
import { TopologyReviewManager } from "../src/setup/topology-review-manager.ts"

async function createStack() {
  const dir = await mkdtemp(join(tmpdir(), "venue-edge-review-"))
  const database = initDatabase(join(dir, "venue-edge.sqlite"))
  const repositories = new EdgeRepositories(database.db)
  const passwordStore = createNvrPasswordStore({
    dataDir: dir,
    secretStoreMode: "memory",
    venueMode: "simulate",
  })
  const nvrManager = new LocalNvrManager(repositories, passwordStore)
  const cameraManager = new LocalCameraManager(
    repositories,
    passwordStore,
    nvrManager,
  )
  const reviewManager = new TopologyReviewManager(
    repositories,
    nvrManager,
    cameraManager,
  )
  return { database, repositories, reviewManager }
}

function insertNvr(repositories, { id = randomUUID(), label }) {
  return repositories.insertLocalNvr({
    id,
    label,
    vendor: "vigi",
    host: "192.168.0.240",
    rtspPort: 554,
    playbackPort: null,
    username: "playtt_edge",
    localConnectionKey: `memory:${id}`,
    enabled: true,
    testChannelKey: "1",
    timeMode: "unknown",
  })
}

test("review keeps the recorder with cameras, removes the empty duplicate, and proposes its label", async () => {
  const { database, repositories, reviewManager } = await createStack()
  const keeper = insertNvr(repositories, { label: "test" })
  const duplicate = insertNvr(repositories, { label: "Playtt" })
  repositories.insertLocalCamera({
    id: randomUUID(),
    nvrId: keeper.id,
    label: "Camera 1",
    channelKey: "1",
    streamProfile: "main",
    codec: "h264",
    enabled: true,
  })

  const proposal = reviewManager.buildProposal()
  assert.deepEqual(proposal.deleteNvrIds, [duplicate.id])
  assert.deepEqual(proposal.renames, [{ nvrId: keeper.id, label: "Playtt" }])
  assert.equal(proposal.requiresManualReview, false)

  const applied = await reviewManager.apply({
    fingerprint: proposal.fingerprint,
    deleteNvrIds: proposal.deleteNvrIds,
    deleteCameraIds: [],
    renames: proposal.renames,
  })
  assert.equal(applied.issues.length, 0)
  assert.equal(repositories.getLocalNvrById(keeper.id)?.label, "Playtt")
  assert.equal(repositories.getLocalNvrById(duplicate.id), null)
  database.close()
})

test("cleanup preselects only failed disabled cameras and rejects stale fingerprints", async () => {
  const { database, repositories, reviewManager } = await createStack()
  const nvr = insertNvr(repositories, { label: "Playtt" })
  const disabled = repositories.insertLocalCamera({
    id: randomUUID(), nvrId: nvr.id, label: "Unused channel", channelKey: "7",
    streamProfile: "main", codec: "unknown", enabled: false,
  })
  const enabled = repositories.insertLocalCamera({
    id: randomUUID(), nvrId: nvr.id, label: "Table camera", channelKey: "8",
    streamProfile: "main", codec: "unknown", enabled: true,
  })
  const failedTest = {
    passed: false,
    testedAt: new Date().toISOString(),
    checks: [{ check: "live_rtsp", passed: false, code: "source_unavailable", message: "No video" }],
  }
  repositories.updateLocalCamera(disabled.id, { lastTest: failedTest })
  repositories.updateLocalCamera(enabled.id, { lastTest: failedTest })

  const proposal = reviewManager.buildProposal()
  assert.deepEqual(proposal.deleteCameraIds, [disabled.id])
  assert.equal(proposal.requiresManualReview, true)

  repositories.updateLocalCamera(disabled.id, { label: "Changed after review" })
  await assert.rejects(
    reviewManager.apply({
      fingerprint: proposal.fingerprint,
      deleteNvrIds: [],
      deleteCameraIds: proposal.deleteCameraIds,
    }),
    (error) => error?.code === "topology_changed",
  )
  database.close()
})
