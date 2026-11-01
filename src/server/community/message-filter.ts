// Small abuse filter for community chat (docs/community/README.md, M3).
// Masks slurs and rejects messages that are only links. It is deliberately
// simple: reports and the admin queue (M4) are the real safety net. Ops can
// extend the word list here.

const MASKED_TERMS = [
  // English slurs
  "nigger",
  "nigga",
  "faggot",
  "fag",
  "retard",
  "cunt",
  "tranny",
  // Swahili / Sheng insults
  "msenge",
  "malaya",
  "kumamako",
  "kuma",
]

// Letters people swap in to dodge filters ("f4ggot", "n1gger").
const LOOKALIKES: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
  "!": "i",
}

const LINK_PATTERN = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|io|co|ke|me|ly|app|link|xyz)(?:\/\S*)?\b/gi

function normalizeWord(word: string) {
  return word
    .toLowerCase()
    .split("")
    .map((char) => LOOKALIKES[char] ?? char)
    .join("")
    .replace(/[^a-z]/g, "")
}

export type MessageFilterResult =
  | { ok: true; body: string; masked: boolean }
  | { ok: false; reason: "EMPTY" | "LINK_ONLY" }

export function filterMessageBody(input: string): MessageFilterResult {
  const body = input.replace(/\s+\n/g, "\n").trim()

  if (body.length === 0) {
    return { ok: false, reason: "EMPTY" }
  }

  const withoutLinks = body.replace(LINK_PATTERN, "").replace(/[\s\p{P}]/gu, "")
  if (withoutLinks.length === 0) {
    return { ok: false, reason: "LINK_ONLY" }
  }

  let masked = false
  const cleaned = body.replace(/[\p{L}\p{N}@$!]+/gu, (word) => {
    const normalized = normalizeWord(word)
    const hit = MASKED_TERMS.some((term) => normalized === term || normalized === `${term}s`)
    if (!hit) return word
    masked = true
    return word[0] + "*".repeat(Math.max(word.length - 1, 2))
  })

  return { ok: true, body: cleaned, masked }
}
