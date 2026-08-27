import { redactSecrets } from "./metrics"

export function collectRedactedDiagnostics(
  input: Record<string, unknown>,
): Record<string, unknown> {
  return redactSecrets(input) as Record<string, unknown>
}

export function diagnosticsContainForbiddenMaterial(
  payload: unknown,
  forbidden: string[],
): boolean {
  const serialized = JSON.stringify(payload)
  return forbidden.some((value) => serialized.includes(value))
}
