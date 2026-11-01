import * as SecureStore from "expo-secure-store"
import { Platform, Share } from "react-native"

import { createInvite } from "@/lib/community-api"
import { INVITE_SHARE_TEXT } from "@/lib/community-types"

const PENDING_INVITE_KEY = "playtt.community.pendingInvite"

/** Same rule as the server: 8 characters, no 0/O/1/I. */
export function normalizeInviteCode(input: string) {
  const code = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
  return /^[A-HJ-NP-Z2-9]{8}$/.test(code) ? code : null
}

export function inviteShareMessage(url: string) {
  return `${INVITE_SHARE_TEXT} ${url}`
}

/** Creates a code and opens the share sheet (WhatsApp is the top Android target). */
export async function shareInvite() {
  const invite = await createInvite()
  const message = inviteShareMessage(invite.url)
  await Share.share(Platform.OS === "ios" ? { message, url: invite.url } : { message, title: "Invite to PlayTT" })
  return invite
}

/**
 * An invite opened before sign-in (playtt://invite/CODE) is kept here and
 * accepted the first time the Community tab opens, so it survives sign-up.
 */
export async function savePendingInvite(code: string) {
  await SecureStore.setItemAsync(PENDING_INVITE_KEY, code)
}

export async function takePendingInvite() {
  const code = await SecureStore.getItemAsync(PENDING_INVITE_KEY)
  if (code) await SecureStore.deleteItemAsync(PENDING_INVITE_KEY)
  return code
}
