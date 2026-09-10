import assert from "node:assert/strict"
import test from "node:test"

import {
  isCommissioningRevisionCurrent,
  normalizeCommissioningRevisionLineage,
  normalizeTopologyReportLineage,
} from "./venue-edge-report-lineage.ts"

test("topology report lineage treats 0 and empty checksum as unset", () => {
  assert.deepEqual(normalizeTopologyReportLineage(0, ""), {
    reportedVersion: null,
    reportChecksumSha256: null,
  })
  assert.deepEqual(normalizeTopologyReportLineage(undefined, null), {
    reportedVersion: null,
    reportChecksumSha256: null,
  })
  assert.deepEqual(normalizeTopologyReportLineage(3, "abc"), {
    reportedVersion: 3,
    reportChecksumSha256: "abc",
  })
})

test("only the revision generated from the latest installation report is current", () => {
  const latest = {
    installationId: "inst-1",
    reportVersion: 3,
    reportChecksumSha256: "latest-checksum",
  }

  assert.equal(
    isCommissioningRevisionCurrent({
      ...latest,
      revisionInstallationId: "inst-1",
      revisionReportVersion: 3,
      revisionReportChecksumSha256: "latest-checksum",
    }),
    true,
  )
  assert.equal(
    isCommissioningRevisionCurrent({
      ...latest,
      revisionInstallationId: "inst-1",
      revisionReportVersion: 2,
      revisionReportChecksumSha256: "old-checksum",
    }),
    false,
  )
  assert.equal(
    isCommissioningRevisionCurrent({
      ...latest,
      revisionInstallationId: null,
      revisionReportVersion: null,
      revisionReportChecksumSha256: null,
    }),
    false,
  )
})

test("config revision lineage is all-null unless version, checksum, and installation are present", () => {
  assert.deepEqual(
    normalizeCommissioningRevisionLineage({
      installationId: "inst-1",
      reportVersion: 0,
      reportChecksumSha256: "",
    }),
    {
      commissioningInstallationId: null,
      sourceReportVersion: null,
      sourceReportChecksumSha256: null,
    },
  )
  assert.deepEqual(
    normalizeCommissioningRevisionLineage({
      installationId: "inst-1",
      reportVersion: 2,
      reportChecksumSha256: "deadbeef",
    }),
    {
      commissioningInstallationId: "inst-1",
      sourceReportVersion: 2,
      sourceReportChecksumSha256: "deadbeef",
    },
  )
})
