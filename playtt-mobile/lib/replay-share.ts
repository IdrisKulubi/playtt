import * as FileSystem from "expo-file-system/legacy"
import { Asset, requestPermissionsAsync } from "expo-media-library"
import * as Sharing from "expo-sharing"

import { getApiBaseUrl } from "@/lib/env"
import { resolveReplayPlaybackUrl } from "@/lib/replays-api"
import type { ReplaySummary } from "@/lib/replay-types"

type ReplayShareSource = Pick<
  ReplaySummary,
  "id" | "title" | "videoUrl" | "playbackExpiresAt"
>

function playbackGrantStillValid(expiresAt?: string) {
  if (!expiresAt) return true
  return new Date(expiresAt).getTime() > Date.now() + 5000
}

function replayCachePath(replayId: string) {
  const base = FileSystem.cacheDirectory
  if (!base) {
    throw new Error("App storage is unavailable. Try again.")
  }
  return `${base}replay-${replayId}.mp4`
}

export function getReplayWebLink(replayId: string): string {
  return `${getApiBaseUrl()}/replays/${encodeURIComponent(replayId)}`
}

export async function getReplayLocalFileUri(
  replay: ReplayShareSource,
): Promise<string> {
  const dest = replayCachePath(replay.id)
  const cached = await FileSystem.getInfoAsync(dest)

  if (
    cached.exists &&
    playbackGrantStillValid(replay.playbackExpiresAt)
  ) {
    return dest
  }

  const url = await resolveReplayPlaybackUrl(replay)
  const result = await FileSystem.downloadAsync(url, dest)

  if (result.status < 200 || result.status >= 300) {
    await FileSystem.deleteAsync(dest, { idempotent: true }).catch(() => {})
    throw new Error("Could not download this clip. Try again in a moment.")
  }

  return result.uri
}

export async function shareReplayVideo(replay: ReplayShareSource): Promise<void> {
  const available = await Sharing.isAvailableAsync()
  if (!available) {
    throw new Error("Sharing is not available on this device.")
  }

  const uri = await getReplayLocalFileUri(replay)
  await Sharing.shareAsync(uri, {
    mimeType: "video/mp4",
    dialogTitle: replay.title,
    UTI: "public.mpeg-4",
  })
}

export async function saveReplayToGallery(
  replay: ReplayShareSource,
): Promise<void> {
  const permission = await requestPermissionsAsync(true)
  if (!permission.granted) {
    throw new Error(
      "Enable Photos access in Settings to save clips.",
    )
  }

  const uri = await getReplayLocalFileUri(replay)
  await Asset.create(uri)
}

export function replayShareErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return "Something went wrong. Try again."
}
