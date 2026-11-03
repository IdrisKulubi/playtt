import { Image } from "expo-image"
import { useState } from "react"

import { DefaultAvatar } from "@/components/account/default-avatar"
import { resolveMediaUrl } from "@/lib/media-url"

type UserAvatarProps = {
  image?: string | null
  size: number
  accessibilityLabel?: string
}

/**
 * A player's photo, or the default picture when there is none. Photos can be
 * stored as paths on our own server, so the address is resolved first; and
 * if a photo can't be loaded for any reason, the default shows instead of
 * an empty circle.
 */
export function UserAvatar({ image, size, accessibilityLabel }: UserAvatarProps) {
  const uri = resolveMediaUrl(image)
  // Remember which address failed, so a new photo gets a fresh try.
  const [failedUri, setFailedUri] = useState<string | null>(null)

  if (!uri || failedUri === uri) return <DefaultAvatar size={size} />

  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      contentFit="cover"
      transition={150}
      accessibilityLabel={accessibilityLabel}
      onError={() => setFailedUri(uri)}
    />
  )
}
