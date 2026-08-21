export class ConcurrencyLimiter {
  private active = 0
  private readonly queue: Array<() => void> = []

  constructor(private readonly max: number) {}

  get activeCount(): number {
    return this.active
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) {
      await new Promise<void>((resolve) => {
        this.queue.push(resolve)
      })
    }

    this.active += 1

    try {
      return await task()
    } finally {
      this.active -= 1
      const next = this.queue.shift()
      next?.()
    }
  }
}

export function createReplayLimiter(maxConcurrent: number): ConcurrencyLimiter {
  return new ConcurrencyLimiter(Math.max(1, maxConcurrent))
}
