import { normalizeKenyaPhone } from "@/server/users/onboarding"

export function formatPhoneForPaystack(input: string) {
  const normalized = normalizeKenyaPhone(input)

  if (!normalized) {
    return null
  }

  return normalized
}
