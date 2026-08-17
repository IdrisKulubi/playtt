declare module "redis" {
  export function createClient(options: { url: string }): {
    connect(): Promise<void>
    quit(): Promise<void>
    duplicate(): ReturnType<typeof createClient>
    publish(channel: string, message: string): Promise<number>
    subscribe(
      channel: string,
      listener: (message: string) => void,
    ): Promise<void>
    unsubscribe(channel: string): Promise<void>
    on?(event: string, listener: (error: unknown) => void): void
  }
}
