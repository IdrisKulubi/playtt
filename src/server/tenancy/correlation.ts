import { randomUUID } from "node:crypto"

export function createCorrelationId() {
  return randomUUID()
}
