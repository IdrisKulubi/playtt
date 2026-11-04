import { useState } from "react"
import { Alert, StyleSheet, View } from "react-native"

import { AccountStackScreen } from "@/components/account/account-stack-screen"
import { Button } from "@/components/kit/button"
import { ListRow } from "@/components/kit/list-row"
import { ListSection } from "@/components/kit/list-section"
import { AppText } from "@/components/ui/app-text"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { ApiError } from "@/lib/api-error"
import { clearSession } from "@/lib/auth-helpers"
import { clearHasSeenWelcome } from "@/lib/welcome-storage"
import { openWebPage } from "@/lib/open-web-page"
import { PRIVACY_URL, SUPPORT_EMAIL } from "@/lib/release-flags"
import { toast } from "@/lib/toast"
import { deleteAccount } from "@/lib/user-api"

/** Apple requires deleting an account to be possible inside the app (Guideline 5.1.1(v)). */
export default function DeleteAccountScreen() {
  const [isDeleting, setIsDeleting] = useState(false)

  function confirm() {
    Alert.alert(
      "Delete your account?",
      "This can't be undone. You'll be signed out and your details will be erased.",
      [
        { text: "Keep my account", style: "cancel" },
        { text: "Delete account", style: "destructive", onPress: () => void remove() },
      ],
    )
  }

  async function remove() {
    setIsDeleting(true)
    try {
      await deleteAccount()
    } catch (error) {
      // Already gone on the server (deleted from another phone): just sign out here.
      const alreadyGone =
        error instanceof ApiError && ["USER_NOT_FOUND", "USER_DELETED", "UNAUTHENTICATED"].includes(error.code ?? "")
      if (alreadyGone) {
        await finish()
        return
      }
      setIsDeleting(false)
      if (error instanceof ApiError && error.code === "ACTIVE_BOOKINGS") {
        toast.error("Cancel your upcoming bookings first, then delete your account.")
        return
      }
      toast.apiError(error, `Could not delete your account. Email ${SUPPORT_EMAIL} and we will do it for you.`)
      return
    }

    await finish()
  }

  /** Nobody uses PlayTT without an account: clear everything and go back to sign in. */
  async function finish() {
    try {
      // Starting over: the next person to open the app sees the intro again.
      await clearHasSeenWelcome().catch(() => undefined)
      // Ending the session sends the signed-in section to the auth screens by itself.
      await clearSession()
    } finally {
      toast.success("Your account has been deleted.")
    }
  }

  return (
    <AccountStackScreen title="Delete account" description="Erase your PlayTT account and the details linked to it.">
      <ListSection header="What gets erased">
        <ListRow icon="person.fill" tone="neutral" title="Your name, email and phone number" />
        <ListRow icon="photo.fill" tone="neutral" title="Your photo and player card" />
        <ListRow icon="bell.fill" tone="neutral" title="Sign-in methods and notification settings" />
        <ListRow icon="rectangle.portrait.and.arrow.right" tone="neutral" title="Every signed-in device" />
      </ListSection>

      <ListSection header="What stays">
        <ListRow
          icon="doc.text.fill"
          tone="neutral"
          title="Booking and payment records"
          subtitle="Kept for tax and accounting rules, but no longer linked to your name or contact details."
        />
      </ListSection>

      <View style={styles.notes}>
        <AppText variant="footnote" color="secondaryLabel">
          You need to cancel any upcoming bookings first. If you signed in with Apple, we also remove PlayTT from your Apple ID.
        </AppText>
      </View>

      <Button label="Delete my account" variant="destructive" loading={isDeleting} onPress={confirm} />
      <Button label="Read the privacy policy" variant="plain" onPress={() => void openWebPage(PRIVACY_URL)} />
    </AccountStackScreen>
  )
}

const styles = StyleSheet.create({
  notes: { gap: PlayTTSpacing.xs },
})
