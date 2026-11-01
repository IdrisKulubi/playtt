import { getApiBaseUrl } from "@/lib/env"

/** Profile photos uploaded to PlayTT come back as app paths (/api/avatars/…); provider photos are absolute. */
export function resolveMediaUrl(url: string | null | undefined) {
  if (!url) return null
  return url.startsWith("/") ? `${getApiBaseUrl()}${url}` : url
}
