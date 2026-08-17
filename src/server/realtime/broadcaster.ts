import { createMemoryRealtimeAdapter } from "./memory-adapter"
import { createRedisRealtimeAdapter } from "./redis-adapter"
import type { RealtimeAdapter } from "./types"

const globalForRealtime = globalThis as typeof globalThis & {
  __playttRealtimeAdapter?: RealtimeAdapter
}

function createCompositeAdapter(): RealtimeAdapter {
  const memory = createMemoryRealtimeAdapter()
  const redisUrl = process.env.REDIS_URL?.trim()

  if (!redisUrl) {
    return memory
  }

  let redisAdapter: RealtimeAdapter

  try {
    redisAdapter = createRedisRealtimeAdapter(redisUrl)
  } catch (error) {
    console.error("[realtime] Failed to initialize Redis adapter", error)
    return memory
  }

  return {
    async publish(channel, message) {
      await Promise.allSettled([
        memory.publish(channel, message),
        redisAdapter.publish(channel, message),
      ])
    },
    subscribe(channel, onMessage) {
      const memorySubscription = memory.subscribe(channel, onMessage)
      const redisSubscription = redisAdapter.subscribe(channel, onMessage)

      return {
        unsubscribe() {
          memorySubscription.unsubscribe()
          redisSubscription.unsubscribe()
        },
      }
    },
  }
}

export function getRealtimeAdapter(): RealtimeAdapter {
  if (!globalForRealtime.__playttRealtimeAdapter) {
    globalForRealtime.__playttRealtimeAdapter = createCompositeAdapter()
  }

  return globalForRealtime.__playttRealtimeAdapter
}

export function resetRealtimeAdapterForTests() {
  delete globalForRealtime.__playttRealtimeAdapter
}
