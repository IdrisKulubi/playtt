import { router, useLocalSearchParams } from "expo-router"
import { type ComponentRef, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, StyleSheet, View } from "react-native"

import { AccountStackScreen } from "@/components/account/account-stack-screen"
import { CardPhotoPicker } from "@/components/community/card-photo-picker"
import {
  CommunityProfileForm,
  profilePatch,
  type CommunityProfileDraft,
} from "@/components/community/community-profile-form"
import { PlayerCard } from "@/components/community/player-card/player-card"
import { cardDataFromMe } from "@/components/community/player-card/card-tiers"
import { Button } from "@/components/kit/button"
import { Button as ProductButton } from "@/components/ui/button"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import { shareMyCard } from "@/lib/card-share"
import { fetchCommunityMe, updateCommunityProfile } from "@/lib/community-api"
import type { CommunityMe } from "@/lib/community-types"
import { toast } from "@/lib/toast"

/** The footer floats up a little before the last action fully leaves the top. */
const REVEAL_LEAD = 120

function draftFrom(me: CommunityMe): CommunityProfileDraft {
  const {
    communityVisible,
    bio,
    playStyle,
    handedness,
    usualTimes,
    requestPolicy,
    showAtVenue,
  } = me.profile
  return {
    communityVisible,
    bio,
    playStyle,
    handedness,
    usualTimes,
    requestPolicy,
    showAtVenue,
  }
}

export default function CommunityProfileScreen() {
  const { setup } = useLocalSearchParams<{ setup?: string }>()
  const isSetup = setup === "1"
  const { colors } = useAppTheme()
  const [me, setMe] = useState<CommunityMe | null>(null)
  const [initial, setInitial] = useState<CommunityProfileDraft | null>(null)
  const [draft, setDraft] = useState<CommunityProfileDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [revealAt, setRevealAt] = useState<number | undefined>(undefined)
  const cardRef = useRef<ComponentRef<typeof View>>(null)

  async function share() {
    setSharing(true)
    try {
      await shareMyCard(cardRef)
      toast.success("Invite link copied. Paste it with your card 🏓")
    } catch (error) {
      toast.apiError(error, "Could not share your card.")
    } finally {
      setSharing(false)
    }
  }

  useEffect(() => {
    let mounted = true
    fetchCommunityMe()
      .then((next) => {
        if (!mounted) return
        const loaded = draftFrom(next)
        setMe(next)
        setInitial(loaded)
        // Coming from "Create my card": the card is switched on by default.
        setDraft(isSetup ? { ...loaded, communityVisible: true } : loaded)
      })
      .catch((error) => toast.apiError(error, "Could not load your card."))
    return () => {
      mounted = false
    }
  }, [isSetup])

  const patch = useMemo(
    () => (initial && draft ? profilePatch(initial, draft) : {}),
    [initial, draft]
  )
  const dirty = Object.keys(patch).length > 0

  async function save() {
    if (!dirty) {
      router.back()
      return
    }
    setSaving(true)
    try {
      await updateCommunityProfile(patch)
      toast.success(
        draft?.communityVisible ? "Your card is live." : "Your card is hidden."
      )
      router.back()
    } catch (error) {
      toast.apiError(error, "Could not save your card.")
    } finally {
      setSaving(false)
    }
  }

  const styles = useMemo(
    () =>
      StyleSheet.create({
        preview: { paddingHorizontal: PlayTTSpacing["2xl"] },
        actions: { gap: PlayTTSpacing.lg },
      }),
    []
  )

  const preview =
    me && draft
      ? cardDataFromMe({
          ...me,
          profile: {
            ...me.profile,
            ...draft,
            bio: draft.bio?.trim() ? draft.bio : null,
          },
        })
      : null

  return (
    <AccountStackScreen
      title={isSetup ? "Create my card" : "My player card"}
      footerRevealOffset={revealAt ?? Number.POSITIVE_INFINITY}
      footer={
        draft && preview ? (
          <Button
            label={isSetup ? "Create my card" : "Save"}
            loading={saving}
            disabled={saving || (!dirty && !isSetup)}
            onPress={save}
          />
        ) : null
      }
      description="Your tier comes from your skill level. Stats fill in as you play."
    >
      {!draft || !preview ? (
        <ActivityIndicator
          style={{ marginTop: PlayTTSpacing.xl }}
          color={colors.secondaryLabel}
        />
      ) : (
        <>
          <View style={styles.preview}>
            {/* collapsable={false} keeps a native view for react-native-view-shot. */}
            <View ref={cardRef} collapsable={false}>
              <PlayerCard player={preview} size="full" flippable />
            </View>
          </View>
          <View
            style={styles.actions}
            onLayout={(event) => {
              const { y, height } = event.nativeEvent.layout
              setRevealAt(y + height - REVEAL_LEAD)
            }}
          >
            <CardPhotoPicker
              hasPhoto={Boolean(me?.image)}
              onChange={(image) =>
                setMe((current) => (current ? { ...current, image } : current))
              }
            />
            {me?.profile.communityVisible && !isSetup ? (
              <ProductButton
                label="Share my card"
                variant="outline"
                surface="product"
                loading={sharing}
                disabled={sharing}
                onPress={share}
              />
            ) : null}
          </View>
          <CommunityProfileForm draft={draft} onChange={setDraft} />
        </>
      )}
    </AccountStackScreen>
  )
}
