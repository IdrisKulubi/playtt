import * as Clipboard from "expo-clipboard"
import * as Sharing from "expo-sharing"
import type { ComponentRef, RefObject } from "react"
import { Platform, type View } from "react-native"
import { captureRef, releaseCapture } from "react-native-view-shot"

import { createInvite } from "@/lib/community-api"
import { inviteShareMessage } from "@/lib/community-invite"

/**
 * "Share my card" (docs/community/player-card.md#sharing): renders the full
 * card as an image and shares it. Image share sheets can't carry text, so the
 * invite link is copied to the clipboard to paste alongside it.
 */
export async function shareMyCard(cardRef: RefObject<ComponentRef<typeof View> | null>) {
  if (Platform.OS === "web" || !(await Sharing.isAvailableAsync())) {
    throw new Error("Card sharing is available in the PlayTT mobile app.")
  }
  if (!cardRef.current) throw new Error("Your card isn't ready yet.")

  const [invite] = await Promise.all([
    createInvite(),
    // Let the card finish its layout before capturing.
    new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  ])

  const uri = await captureRef(cardRef, { format: "png", result: "tmpfile", quality: 1 })
  try {
    await Clipboard.setStringAsync(inviteShareMessage(invite.url))
    await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: "Share your PlayTT card" })
  } finally {
    releaseCapture(uri)
  }
  return invite
}
