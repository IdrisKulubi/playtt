import { createMemoryRealtimeAdapter } from "./memory-adapter"
import type { RealtimeAdapter, RealtimeSubscription } from "./types"

const globalForRealtime = globalThis as typeof globalThis & {
  __playttRealtimeAdapter?: RealtimeAdapter
}

async function loadRedisAdapter(redisUrl: string): Promise<RealtimeAdapter | null> {
  try {
    const { createRedisRealtimeAdapter } = await import("./redis-adapter")
    return createRedisRealtimeAdapter(redisUrl)
  } catch (error) {
    console.error("[realtime] Failed to initialize Redis adapter", error)
    return null
  }
}

function createCompositeAdapter(): RealtimeAdapter {
  const memory = createMemoryRealtimeAdapter()
  const redisUrl = process.env.REDIS_URL?.trim()

  if (!redisUrl) {
    return memory
  }

  let redisAdapterPromise: Promise<RealtimeAdapter | null> | null = null

  const getRedisAdapter = () => {
    redisAdapterPromise ??= loadRedisAdapter(redisUrl)
    return redisAdapterPromise
  }

  return {
    async publish(channel, message) {
      await memory.publish(channel, message)

      const redis = await getRedisAdapter()
      if (redis) {
        await redis.publish(channel, message)
      }
    },
    subscribe(channel, onMessage) {
      const memorySubscription = memory.subscribe(channel, onMessage)
      let redisSubscription: RealtimeSubscription | null = null
      let cancelled = false

      void getRedisAdapter().then((redis) => {
        if (!redis || cancelled) {
          return
        }

        redisSubscription = redis.subscribe(channel, onMessage)
      })

      return {
        unsubscribe() {
          cancelled = true
          memorySubscription.unsubscribe()
          redisSubscription?.unsubscribe()
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
