/**
 * Outbox consumers are registered before producers emit events.
 * Unknown event types are left unclaimed until a consumer exists.
 * Unsupported versions of a registered type are skipped without crashing.
 */
export const OUTBOX_CONSUMERS = {}

export function getRegisteredOutboxConsumers() {
  return OUTBOX_CONSUMERS
}
