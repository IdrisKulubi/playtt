export interface TopologyReportLineage {
  reportedVersion: number | null
  reportChecksumSha256: string | null
}

export interface CommissioningRevisionLineage {
  commissioningInstallationId: string | null
  sourceReportVersion: number | null
  sourceReportChecksumSha256: string | null
}

export function isCommissioningRevisionCurrent(input: {
  installationId: string
  reportVersion: number | null | undefined
  reportChecksumSha256: string | null | undefined
  revisionInstallationId: string | null | undefined
  revisionReportVersion: number | null | undefined
  revisionReportChecksumSha256: string | null | undefined
}): boolean {
  const report = normalizeTopologyReportLineage(
    input.reportVersion,
    input.reportChecksumSha256,
  )
  const revision = normalizeCommissioningRevisionLineage({
    installationId: input.revisionInstallationId,
    reportVersion: input.revisionReportVersion,
    reportChecksumSha256: input.revisionReportChecksumSha256,
  })

  return Boolean(
    report.reportedVersion &&
      report.reportChecksumSha256 &&
      revision.commissioningInstallationId === input.installationId &&
      revision.sourceReportVersion === report.reportedVersion &&
      revision.sourceReportChecksumSha256 === report.reportChecksumSha256,
  )
}

export function normalizeTopologyReportLineage(
  version: number | null | undefined,
  checksum: string | null | undefined,
): TopologyReportLineage {
  const reportedVersion =
    typeof version === "number" && Number.isSafeInteger(version) && version > 0
      ? version
      : null
  const reportChecksumSha256 =
    typeof checksum === "string" && checksum.length > 0 ? checksum : null
  return { reportedVersion, reportChecksumSha256 }
}

export function normalizeCommissioningRevisionLineage(input: {
  installationId?: string | null
  reportVersion?: number | null
  reportChecksumSha256?: string | null
}): CommissioningRevisionLineage {
  const { reportedVersion, reportChecksumSha256 } =
    normalizeTopologyReportLineage(
      input.reportVersion,
      input.reportChecksumSha256,
    )
  if (!input.installationId || !reportedVersion || !reportChecksumSha256) {
    return {
      commissioningInstallationId: null,
      sourceReportVersion: null,
      sourceReportChecksumSha256: null,
    }
  }
  return {
    commissioningInstallationId: input.installationId,
    sourceReportVersion: reportedVersion,
    sourceReportChecksumSha256: reportChecksumSha256,
  }
}
