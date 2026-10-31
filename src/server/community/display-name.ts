// Community surfaces only ever show "First L." so full names stay private.
export function toCommunityDisplayName(fullName: string | null | undefined) {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean)

  if (parts.length === 0) {
    return "Player"
  }

  const [first, ...rest] = parts
  const last = rest.at(-1)

  if (!last) {
    return first
  }

  return `${first} ${last.charAt(0).toLocaleUpperCase()}.`
}
