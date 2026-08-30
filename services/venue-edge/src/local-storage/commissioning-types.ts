export interface CommissioningStateRow {
  completed: boolean
  completedAt: string | null
  publishedAt: string | null
  reportVersion: number
  failoverReady: boolean
  lastError: string | null
  drillResults: Record<string, CommissioningDrillResult>
  updatedAt: string
}

export interface CommissioningDrillResult {
  passed: boolean
  primaryCameraId: string | null
  selectedCameraId: string | null
  selectionReason: string | null
  skipped?: boolean
  message?: string
}

export interface CommissioningChecklist {
  enrolled: boolean
  enabledCameraCount: number
  allEnabledCamerasTested: boolean
  allEnabledCamerasPreviewed: boolean
  failoverReady: boolean
  published: boolean
  configApplied: boolean
  completed: boolean
  canComplete: boolean
  blockingReasons: string[]
  recommendedReasons: string[]
}
