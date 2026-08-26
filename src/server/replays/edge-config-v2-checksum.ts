import { createHash } from "node:crypto"

function canonicalizeValue(value: unknown, path: string): string {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return JSON.stringify(value)
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`Cannot canonicalize non-finite number at ${path}.`)
    }
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value
      .map((entry, index) => canonicalizeValue(entry, `${path}[${index}]`))
      .join(",")}]`
  }

  if (value && typeof value === "object") {
    // Default string ordering compares UTF-16 code units and is independent of
    // the host locale/ICU version, unlike locale-aware comparison.
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)
    )
    return `{${entries
      .map(
        ([key, nested]) =>
          `${JSON.stringify(key)}:${canonicalizeValue(nested, `${path}.${key}`)}`
      )
      .join(",")}}`
  }

  throw new Error(`Cannot canonicalize ${typeof value} at ${path}.`)
}

export function canonicalizeEdgeConfigSnapshot(snapshot: unknown): string {
  return canonicalizeValue(snapshot, "$")
}

export function checksumEdgeConfigSnapshot(snapshot: unknown): string {
  return createHash("sha256")
    .update(canonicalizeEdgeConfigSnapshot(snapshot), "utf8")
    .digest("hex")
}

export function cloneCanonicalEdgeConfigSnapshot<T>(snapshot: T): T {
  return JSON.parse(canonicalizeEdgeConfigSnapshot(snapshot)) as T
}
