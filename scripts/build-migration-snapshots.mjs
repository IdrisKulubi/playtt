import { randomUUID } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const metaDirectory = join(root, "drizzle", "meta")

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"))
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function cloneSnapshot(snapshot, { id, prevId }) {
  return {
    ...snapshot,
    id,
    prevId,
  }
}

function buildOnboardingSnapshot(baseSnapshot, fullSnapshot) {
  const next = structuredClone(baseSnapshot)
  const userTable = fullSnapshot.tables["public.user"]
  next.tables["public.user"] = structuredClone(userTable)
  return next
}

function main() {
  const snap0 = readJson(join(metaDirectory, "0000_snapshot.json"))
  const fullCandidatePath = join(metaDirectory, "0002_snapshot.json")
  let fullSnapshot

  try {
    fullSnapshot = readJson(fullCandidatePath)
  } catch {
    throw new Error(
      "Expected drizzle/meta/0002_snapshot.json from a one-time drizzle-kit generate run.",
    )
  }

  const snap1Body = buildOnboardingSnapshot(snap0, fullSnapshot)
  const snap1 = cloneSnapshot(snap1Body, {
    id: randomUUID(),
    prevId: snap0.id,
  })
  const snap2 = cloneSnapshot(fullSnapshot, {
    id: randomUUID(),
    prevId: snap1.id,
  })
  const snap3 = cloneSnapshot(fullSnapshot, {
    id: randomUUID(),
    prevId: snap2.id,
  })
  const snap4 = cloneSnapshot(fullSnapshot, {
    id: randomUUID(),
    prevId: snap3.id,
  })

  writeJson(join(metaDirectory, "0001_snapshot.json"), snap1)
  writeJson(join(metaDirectory, "0002_snapshot.json"), snap2)
  writeJson(join(metaDirectory, "0003_snapshot.json"), snap3)
  writeJson(join(metaDirectory, "0004_snapshot.json"), snap4)

  writeJson(join(metaDirectory, "_journal.json"), {
    version: "7",
    dialect: "postgresql",
    entries: [
      {
        idx: 0,
        version: "7",
        when: 1775417313742,
        tag: "0000_curvy_hiroim",
        breakpoints: true,
      },
      {
        idx: 1,
        version: "7",
        when: 1781035000000,
        tag: "0001_user_onboarding",
        breakpoints: true,
      },
      {
        idx: 2,
        version: "7",
        when: 1782000000000,
        tag: "0002_booking_edits",
        breakpoints: true,
      },
      {
        idx: 3,
        version: "7",
        when: 1783000000000,
        tag: "0003_coach_replay_credits",
        breakpoints: true,
      },
      {
        idx: 4,
        version: "7",
        when: 1784000000000,
        tag: "0004_booking_credit_ledger",
        breakpoints: true,
      },
    ],
  })

  const integrityPath = join(root, "drizzle", "migration-integrity.json")
  const integrity = readJson(integrityPath)
  integrity.acknowledgedMetadataDrift = []
  writeJson(integrityPath, integrity)

  console.log("Wrote migration snapshots 0001-0004 and repaired journal metadata.")
}

main()
