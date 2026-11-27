export interface VideoExtractionRequest {
  replayRequestId: string
  captureAt: string
  preRollSeconds: number
  postRollSeconds: number
  outputPath: string
}

export interface VideoExtractionResult {
  outputPath: string
  source: "edge_buffer" | "nvr_playback"
  durationSeconds: number
  /** Stage durations (ms) and facts for the per-replay timing log. */
  timings?: Record<string, number | string | boolean | null>
}

export interface VideoAdapter {
  readonly name: string
  isAvailable(): Promise<boolean>
  extractClip(request: VideoExtractionRequest): Promise<VideoExtractionResult>
}
