export function streamProfileToVigiStream(streamProfile: string): string {
  const normalized = streamProfile.trim().toLowerCase()
  if (normalized === "substream" || normalized === "sub") {
    return "2"
  }

  return "1"
}

export function buildVigiLiveRtspUrl(input: {
  host: string
  rtspPort: number
  username: string
  password: string
  channelKey: string
  streamProfile: string
}): string {
  const user = encodeURIComponent(input.username)
  const password = encodeURIComponent(input.password)
  const stream = streamProfileToVigiStream(input.streamProfile)
  const channel = encodeURIComponent(input.channelKey)
  return `rtsp://${user}:${password}@${input.host}:${input.rtspPort}/live/${channel}/${stream}/avm`
}

export function formatVigiTime(date: Date, suffix: "z" | "l" = "z"): string {
  if (suffix === "l") {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    const h = String(date.getHours()).padStart(2, "0")
    const min = String(date.getMinutes()).padStart(2, "0")
    const s = String(date.getSeconds()).padStart(2, "0")
    return `${y}${m}${d}t${h}${min}${s}l`
  }

  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, "0")
  const d = String(date.getUTCDate()).padStart(2, "0")
  const h = String(date.getUTCHours()).padStart(2, "0")
  const min = String(date.getUTCMinutes()).padStart(2, "0")
  const s = String(date.getUTCSeconds()).padStart(2, "0")
  return `${y}${m}${d}t${h}${min}${s}z`
}

export function buildVigiPlaybackUrl(
  liveRtspUrl: string,
  start: Date,
  end: Date,
  suffix: "z" | "l" = "z",
): string | null {
  let parsed: URL

  try {
    parsed = new URL(liveRtspUrl)
  } catch {
    return null
  }

  const match = parsed.pathname.match(/\/live\/(\d+)\/(\d+)\//)
  if (!match) {
    return null
  }

  const user = parsed.username
  const password = parsed.password
  const auth =
    user || password
      ? `${encodeURIComponent(decodeURIComponent(user))}:${encodeURIComponent(decodeURIComponent(password))}@`
      : ""
  const host = parsed.host
  const path = `/replay/${match[1]}/${match[2]}/avm?starttime=${formatVigiTime(start, suffix)}&endtime=${formatVigiTime(end, suffix)}`

  return `rtsp://${auth}${host}${path}`
}
