import {
  formatUnknownEnumValue,
  isKnownReplayStatus,
} from "./status-values"

export function formatReplayStatus(status: string) {
  if (status === "ready") return "Ready"
  if (status === "processing") return "Processing"
  if (status === "pending") return "Pending"
  if (status === "failed") return "Failed"
  if (status === "cancelled") return "Cancelled"
  if (isKnownReplayStatus(status)) return formatUnknownEnumValue(status)
  return formatUnknownEnumValue(status)
}
