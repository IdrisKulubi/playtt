import { router, useLocalSearchParams } from "expo-router"
import { useEffect, useMemo, useState } from "react"
import { ActivityIndicator, StyleSheet, View } from "react-native"

import { AccountStackScreen } from "@/components/account/account-stack-screen"
import {
  CommunityProfileForm,
  profilePatch,
  type CommunityProfileDraft,
} from "@/components/community/community-profile-form"
import { PlayerCard } from "@/components/community/player-card/player-card"
import { cardDataFromMe } from "@/components/community/player-card/card-tiers"
import { Button } from "@/components/ui/button"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import { fetchCommunityMe, updateCommunityProfile } from "@/lib/community-api"
import type { CommunityMe } from "@/lib/community-types"
import { toast } from "@/lib/toast"

function draftFrom(me: CommunityMe): CommunityProfileDraft {
  const { communityVisible, bio, playStyle, handedness, usualTimes, requestPolicy, showAtVenue } = me.profile
  return { communityVisible, bio, playStyle, handedness, usualTimes, requestPolicy, showAtVenue }
}

export default function CommunityProfileScreen() {
  const { setup } = useLocalSearchParams<{ setup?: string }>()
  const isSetup = setup === "1"
  const theme = useProductTheme()
  const [me, setMe] = useState<CommunityMe | null>(null)
  const [initial, setInitial] = useState<CommunityProfileDraft | null>(null)
  const [draft, setDraft] = useState<CommunityProfileDraft | null>(null)
  const [saving, setSaving] = useState(false)

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

  const patch = useMemo(() => (initial && draft ? profilePatch(initial, draft) : {}), [initial, draft])
  const dirty = Object.keys(patch).length > 0

  async function save() {
    if (!dirty) {
      router.back()
      return
    }
    setSaving(true)
    try {
      await updateCommunityProfile(patch)
      toast.success(draft?.communityVisible ? "Your card is live." : "Your card is hidden.")
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
      }),
    [],
  )

  const preview =
    me && draft
      ? cardDataFromMe({
          ...me,
          profile: { ...me.profile, ...draft, bio: draft.bio?.trim() ? draft.bio : null },
        })
      : null

  return (
    <AccountStackScreen
      title={isSetup ? "Create my card" : "My player card"}
      description="Your tier comes from your skill level. Stats fill in as you play."
    >
      {!draft || !preview ? (
        <ActivityIndicator style={{ marginTop: PlayTTSpacing.xl }} color={theme.muted} />
      ) : (
        <>
          <View style={styles.preview}>
            <PlayerCard player={preview} size="full" flippable />
          </View>
          <CommunityProfileForm draft={draft} onChange={setDraft} />
          <Button
            label={isSetup ? "Create my card" : "Save"}
            surface="product"
            productTheme={theme}
            loading={saving}
            disabled={saving || (!dirty && !isSetup)}
            onPress={save}
          />
        </>
      )}
    </AccountStackScreen>
  )
}
