// Account deletion for App Review (Guideline 5.1.1(v)) and the Kenya Data Protection Act.
// Bookings and payments must stay for accounting, so the person is anonymised:
// everything that identifies them is removed and they can no longer sign in.

import { randomUUID } from "node:crypto"

import { and, eq, gt, inArray } from "drizzle-orm"

import db from "../../../db/drizzle"
import {
  account,
  bookings,
  playerProfiles,
  pushDeviceTokens,
  session,
  user,
  verification,
} from "../../../db/schema"
import { resolveAppleClientSecret } from "@/lib/apple-client-secret"
import { removeAvatar } from "./avatar"

export const DELETED_PLAYER_NAME = "Deleted player"

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; code: "USER_NOT_FOUND" | "ACTIVE_BOOKINGS"; message: string }

/** Tell Apple to cancel the Sign in with Apple link. Never blocks the deletion. */
async function revokeAppleAccess(refreshToken: string | null) {
  if (!refreshToken || !process.env.APPLE_CLIENT_ID) return
  try {
    const clientSecret = await resolveAppleClientSecret()
    if (!clientSecret) return
    await fetch("https://appleid.apple.com/auth/revoke", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.APPLE_CLIENT_ID,
        client_secret: clientSecret,
        token: refreshToken,
        token_type_hint: "refresh_token",
      }),
    })
  } catch (error) {
    console.error("[ACCOUNT] Apple token revocation failed", error)
  }
}

export async function deleteUserAccount(userId: string): Promise<DeleteAccountResult> {
  const [current] = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  if (!current) {
    return { ok: false, code: "USER_NOT_FOUND", message: "Account not found." }
  }

  // A paid table in the future would be lost; ask the player to cancel it first.
  const upcoming = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.userId, userId),
        inArray(bookings.status, ["pending", "confirmed"]),
        gt(bookings.endTime, new Date()),
      ),
    )
    .limit(1)
  if (upcoming.length > 0) {
    return {
      ok: false,
      code: "ACTIVE_BOOKINGS",
      message: "Cancel your upcoming bookings first, then delete your account.",
    }
  }

  const appleAccounts = await db
    .select({ refreshToken: account.refreshToken })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "apple")))

  await removeAvatar(userId).catch(() => undefined)
  await Promise.all(appleAccounts.map((row) => revokeAppleAccess(row.refreshToken)))

  await db.transaction(async (tx) => {
    await tx.delete(pushDeviceTokens).where(eq(pushDeviceTokens.userId, userId))
    await tx.delete(session).where(eq(session.userId, userId))
    await tx.delete(account).where(eq(account.userId, userId))
    await tx.delete(verification).where(eq(verification.identifier, current.email))
    await tx
      .update(playerProfiles)
      .set({ communityVisible: false, bio: null, usualTimes: [], showAtVenue: false })
      .where(eq(playerProfiles.userId, userId))
    await tx
      .update(user)
      .set({
        name: DELETED_PLAYER_NAME,
        email: `deleted-${randomUUID()}@deleted.theplaytt.com`,
        emailVerified: false,
        image: null,
        phone: null,
        phoneVerified: false,
        referralSource: null,
        playIntent: null,
        earlyAdopterOptIn: false,
        twoFactorEnabled: false,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId))
  })

  return { ok: true }
}
