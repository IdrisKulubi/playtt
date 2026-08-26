const SENSITIVE_KEY =
  /(?:passcode|password|secret|token|authorization|keyboardpwd|accesscode)/i
const EIGHT_DIGIT_CODE = /\b\d{8}\b/g

export function redactAccessText(value) {
  return String(value).replace(EIGHT_DIGIT_CODE, "[REDACTED_CODE]")
}

export function redactAccessValue(value, seen = new WeakSet()) {
  if (typeof value === "string") return redactAccessText(value)
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) return "[CIRCULAR]"

  seen.add(value)

  if (Array.isArray(value)) {
    return value.map((item) => redactAccessValue(item, seen))
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactAccessValue(item, seen),
    ]),
  )
}
