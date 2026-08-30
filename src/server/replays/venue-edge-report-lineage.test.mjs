import assert from "node:assert/strict"
import test from "node:test"

import {
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
