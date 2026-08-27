export type LocalNvrVendor = "vigi"
export type LocalNvrTimeMode = "z" | "l" | "unknown"

export interface LocalNvrTestSummary {
  passed: boolean
  testedAt: string
  timeMode: LocalNvrTimeMode
  checks: Array<{
    check: string
    passed: boolean
    code?: string
    message: string
  }>
}

export interface LocalNvrRow {
  id: string
  label: string
  vendor: LocalNvrVendor
  host: string
  rtspPort: number
  playbackPort: number | null
  username: string
  localConnectionKey: string
  enabled: boolean
  testChannelKey: string
  timeMode: LocalNvrTimeMode
  lastTest: LocalNvrTestSummary | null
  createdAt: string
  updatedAt: string
}

export interface LocalNvrPublicView {
  id: string
  label: string
  vendor: LocalNvrVendor
  host: string
  rtspPort: number
  playbackPort: number | null
  username: string
  localConnectionKey: string
  enabled: boolean
  testChannelKey: string
  timeMode: LocalNvrTimeMode
  hasPassword: boolean
  lastTest: LocalNvrTestSummary | null
  createdAt: string
  updatedAt: string
}

export function mintLocalConnectionKey(nvrId: string): string {
  return `windows-dpapi:nvr-${nvrId}`
}
