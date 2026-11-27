/**
 * Per-replay stage timings, logged once as "Replay timing" when a replay
 * finishes (or fails). Answers "where did the seconds between tap and TV go?"
 *
 * Times measured against `captureAt` mix the cloud's clock (captureAt is set
 * when the cloud receives the tap) with this PC's clock, so they are only as
 * accurate as the two clocks agree. Everything else is local and exact.
 */
export type ReplayTimingFields = Record<string, number | string | boolean | null>

export class ReplayTimer {
  private readonly fields: ReplayTimingFields = {}
  private readonly startedAtMs: number

  constructor(
    private readonly captureAtMs: number,
    private readonly now: () => number = Date.now,
    receivedAtMs?: number,
  ) {
    this.startedAtMs = receivedAtMs ?? now()
    this.fields.tapToEdgeMs = Number.isFinite(captureAtMs)
      ? Math.round(this.startedAtMs - captureAtMs)
      : null
  }

  /** Runs `work` and records how long it took under `name` (also on failure). */
  async time<T>(name: string, work: () => Promise<T>): Promise<T> {
    const started = this.now()
    try {
      return await work()
    } finally {
      this.fields[name] = Math.round(this.now() - started)
    }
  }

  set(name: string, value: number | string | boolean | null | undefined): void {
    if (value === undefined) {
      return
    }
    this.fields[name] =
      typeof value === "number" ? Math.round(value * 100) / 100 : value
  }

  /** Records how long after the tap (captureAt) this moment is. */
  markSinceTap(name: string): void {
    this.fields[name] = Number.isFinite(this.captureAtMs)
      ? Math.round(this.now() - this.captureAtMs)
      : null
  }

  merge(values: ReplayTimingFields | undefined): void {
    for (const [name, value] of Object.entries(values ?? {})) {
      this.set(name, value)
    }
  }

  /** The one log line's fields: every stage plus totals as of now. */
  summary(outcome: "ready" | "failed"): ReplayTimingFields {
    const now = this.now()
    const bytes = this.fields.sizeBytes
    const uploadMs = this.fields.uploadMs
    const uploadMbps =
      typeof bytes === "number" && typeof uploadMs === "number" && uploadMs > 0
        ? Math.round(((bytes * 8) / 1_000_000 / (uploadMs / 1000)) * 10) / 10
        : null

    return {
      outcome,
      ...this.fields,
      uploadMbps,
      edgeTotalMs: Math.round(now - this.startedAtMs),
      tapToReadyMs: Number.isFinite(this.captureAtMs)
        ? Math.round(now - this.captureAtMs)
        : null,
    }
  }
}
