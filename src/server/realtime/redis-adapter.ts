import type {
  RealtimeAdapter,
  RealtimeMessage,
  RealtimeSubscription,
} from "./types"

type RedisClient = {
  publish(channel: string, message: string): Promise<number>
  subscribe(channel: string, listener: (message: string) => void): Promise<void>
  unsubscribe(channel: string): Promise<void>
  duplicate(): RedisClient
  connect(): Promise<void>
  quit(): Promise<void>
  on(event: string, listener: (error: unknown) => void): void
}

function logRedisAdapterError(action: string, error: unknown) {
  console.error(`[realtime:redis] ${action} failed`, error)
}

async function loadRedisCreateClient() {
  try {
    // Keep redis optional: avoid bundler static analysis of the peer package.
    const loadModule = new Function(
      "specifier",
      "return import(specifier)",
    ) as (specifier: string) => Promise<{
      createClient: (options: { url: string }) => RedisClient
    }>

    const module = await loadModule("redis")
    return module.createClient
  } catch (error) {
    logRedisAdapterError("module load", error)
    return null
  }
}

export class RedisRealtimeAdapter implements RealtimeAdapter {
  private publisher: RedisClient | null = null
  private subscriber: RedisClient | null = null
  private readonly channelHandlers = new Map<
    string,
    Set<(message: RealtimeMessage) => void>
  >()
  private readonly subscribedChannels = new Set<string>()

  constructor(private readonly redisUrl: string) {}

  private async getPublisher() {
    if (this.publisher) {
      return this.publisher
    }

    const createClient = await loadRedisCreateClient()
    if (!createClient) {
      throw new Error("Redis client module is unavailable.")
    }

    this.publisher = createClient({ url: this.redisUrl })
    this.publisher.on("error", (error: unknown) => {
      logRedisAdapterError("publisher error", error)
    })
    await this.publisher.connect()
    return this.publisher
  }

  private async getSubscriber() {
    if (this.subscriber) {
      return this.subscriber
    }

    const publisher = await this.getPublisher()
    this.subscriber = publisher.duplicate()
    this.subscriber.on("error", (error: unknown) => {
      logRedisAdapterError("subscriber error", error)
    })
    await this.subscriber.connect()
    return this.subscriber
  }

  async publish(channel: string, message: RealtimeMessage): Promise<void> {
    try {
      const publisher = await this.getPublisher()
      await publisher.publish(channel, JSON.stringify(message))
    } catch (error) {
      logRedisAdapterError("publish", error)
    }
  }

  subscribe(
    channel: string,
    onMessage: (message: RealtimeMessage) => void,
  ): RealtimeSubscription {
    const handlers =
      this.channelHandlers.get(channel) ??
      new Set<(message: RealtimeMessage) => void>()

    handlers.add(onMessage)
    this.channelHandlers.set(channel, handlers)

    void this.ensureChannelSubscription(channel)

    return {
      unsubscribe: () => {
        const current = this.channelHandlers.get(channel)
        current?.delete(onMessage)

        if (current && current.size === 0) {
          this.channelHandlers.delete(channel)
          void this.unsubscribeChannel(channel)
        }
      },
    }
  }

  private async ensureChannelSubscription(channel: string) {
    if (this.subscribedChannels.has(channel)) {
      return
    }

    try {
      const subscriber = await this.getSubscriber()
      await subscriber.subscribe(channel, (rawMessage) => {
        try {
          const parsed = JSON.parse(rawMessage) as RealtimeMessage
          const handlers = this.channelHandlers.get(channel)

          handlers?.forEach((handler) => {
            handler(parsed)
          })
        } catch (error) {
          logRedisAdapterError("message parse", error)
        }
      })
      this.subscribedChannels.add(channel)
    } catch (error) {
      logRedisAdapterError("subscribe", error)
    }
  }

  private async unsubscribeChannel(channel: string) {
    if (!this.subscribedChannels.has(channel)) {
      return
    }

    try {
      const subscriber = await this.getSubscriber()
      await subscriber.unsubscribe(channel)
      this.subscribedChannels.delete(channel)
    } catch (error) {
      logRedisAdapterError("unsubscribe", error)
    }
  }
}

export function createRedisRealtimeAdapter(redisUrl: string): RealtimeAdapter {
  return new RedisRealtimeAdapter(redisUrl)
}
