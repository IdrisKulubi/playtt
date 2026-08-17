import { isDuplicateScoreSuccess, withRetry } from "./retry.mjs"

/**
 * @typedef {import("./client.mjs").DeviceV1Client} DeviceV1Client
 * @typedef {import("./event-buffer.mjs").BufferedScoreEvent} BufferedScoreEvent
 */

/**
 * @param {DeviceV1Client} client
 * @param {{ peek: () => BufferedScoreEvent | null, ack: () => void }} buffer
 */
export async function flushEventBuffer(client, buffer) {
  /** @type {unknown[]} */
  const results = []

  while (buffer.peek()) {
    const event = buffer.peek()
    if (!event) {
      break
    }

    const body = await withRetry(() => client.postScoreEvent(event))

    if (isDuplicateScoreSuccess(body)) {
      buffer.ack()
      results.push(body)
      continue
    }

    buffer.ack()
    results.push(body)
  }

  return results
}
