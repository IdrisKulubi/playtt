/**
 * @typedef {Object} BufferedScoreEvent
 * @property {string} bootId
 * @property {number} sequence
 * @property {"point" | "correction"} kind
 * @property {"a" | "b"} side
 * @property {number} delta
 */

/**
 * @param {string} bootId
 */
export function createEventBuffer(bootId) {
  /** @type {BufferedScoreEvent[]} */
  const queue = []
  let nextSequence = 1

  return {
    bootId,

    /**
     * @param {{ kind?: "point" | "correction", side: "a" | "b", delta?: number }} input
     * @returns {BufferedScoreEvent}
     */
    enqueue(input) {
      const event = {
        bootId,
        sequence: nextSequence,
        kind: input.kind ?? "point",
        side: input.side,
        delta: input.delta ?? 1,
      }

      nextSequence += 1
      queue.push(event)
      return event
    },

    peek() {
      return queue[0] ?? null
    },

    ack() {
      queue.shift()
    },

    size() {
      return queue.length
    },

    all() {
      return [...queue]
    },

    nextSequence() {
      return nextSequence
    },
  }
}
