import { EventEmitter } from "node:events"

import type {
  RealtimeAdapter,
  RealtimeSubscription,
  ScoreHint,
} from "./types"

const globalForRealtime = globalThis as typeof globalThis & {
  __playttMemoryRealtime?: EventEmitter
}

function getEmitter() {
  if (!globalForRealtime.__playttMemoryRealtime) {
    globalForRealtime.__playttMemoryRealtime = new EventEmitter()
    globalForRealtime.__playttMemoryRealtime.setMaxListeners(100)
  }

  return globalForRealtime.__playttMemoryRealtime
}

export class MemoryRealtimeAdapter implements RealtimeAdapter {
  private readonly emitter = getEmitter()

  async publish(channel: string, message: ScoreHint): Promise<void> {
    this.emitter.emit(channel, message)
  }

  subscribe(
    channel: string,
    onMessage: (message: ScoreHint) => void,
  ): RealtimeSubscription {
    const handler = (message: ScoreHint) => {
      onMessage(message)
    }

    this.emitter.on(channel, handler)

    return {
      unsubscribe: () => {
        this.emitter.off(channel, handler)
      },
    }
  }
}

export function createMemoryRealtimeAdapter(): RealtimeAdapter {
  return new MemoryRealtimeAdapter()
}
