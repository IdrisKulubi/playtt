import { useMemo } from "react"
import { Pressable, StyleSheet, Switch, Text, View } from "react-native"

import { AccountGlassSection } from "@/components/account/account-glass-section"
import { Input } from "@/components/ui/input"
import { liquidGlassLabelColor, liquidGlassSelectionChipColor } from "@/components/ui/liquid-glass-chrome"
import { PlayTTColors, PlayTTFontFamilies, PlayTTSpacing } from "@/constants/playtt-tokens"
import { resolveColorScheme } from "@/constants/theme"
import { useColorScheme } from "@/hooks/use-color-scheme"
import { useProductTheme } from "@/hooks/use-product-theme"
import {
  USUAL_TIME_KEYS,
  type CommunityHandedness,
  type CommunityPlayStyle,
  type CommunityProfile,
  type CommunityRequestPolicy,
  type UsualTimeKey,
} from "@/lib/community-types"

import { USUAL_TIME_LABELS } from "./player-card/card-tiers"

export const BIO_MAX = 140

export type CommunityProfileDraft = Pick<
  CommunityProfile,
  "communityVisible" | "bio" | "playStyle" | "handedness" | "usualTimes" | "requestPolicy" | "showAtVenue"
>

const PLAY_STYLES: { value: CommunityPlayStyle; label: string }[] = [
  { value: "attacker", label: "Attacker" },
  { value: "defender", label: "Defender" },
  { value: "all_round", label: "All-round" },
]

const HANDEDNESS: { value: CommunityHandedness; label: string }[] = [
  { value: "right", label: "Right-handed" },
  { value: "left", label: "Left-handed" },
]

const POLICIES: { value: CommunityRequestPolicy; label: string; detail: string }[] = [
  { value: "everyone", label: "Everyone", detail: "Any player at your venue" },
  { value: "followers", label: "My followers", detail: "Only players who follow you" },
  { value: "rally_partners", label: "Rally Partners", detail: "Only players you follow each other with" },
]

/** Only the fields that changed, so PATCH never resends untouched values. */
export function profilePatch(initial: CommunityProfileDraft, draft: CommunityProfileDraft) {
  const patch: Partial<CommunityProfileDraft> = {}
  const keys = Object.keys(draft) as (keyof CommunityProfileDraft)[]
  for (const key of keys) {
    if (JSON.stringify(initial[key]) !== JSON.stringify(draft[key])) {
      Object.assign(patch, { [key]: draft[key] })
    }
  }
  if (patch.bio !== undefined) {
    patch.bio = patch.bio?.trim() ? patch.bio.trim() : null
  }
  return patch
}

type CommunityProfileFormProps = {
  draft: CommunityProfileDraft
  onChange: (draft: CommunityProfileDraft) => void
}

export function CommunityProfileForm({ draft, onChange }: CommunityProfileFormProps) {
  const theme = useProductTheme()
  const colorScheme = resolveColorScheme(useColorScheme())

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: PlayTTSpacing.md,
          padding: PlayTTSpacing.md,
        },
        divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.border, marginLeft: PlayTTSpacing.md },
        copy: { flex: 1, gap: 2 },
        title: { fontFamily: PlayTTFontFamilies.semiBold, fontSize: 16, color: theme.foreground },
        detail: { fontFamily: PlayTTFontFamilies.regular, fontSize: 13, color: theme.muted, lineHeight: 18 },
        block: { padding: PlayTTSpacing.md, gap: PlayTTSpacing.xs },
        chips: { flexDirection: "row", flexWrap: "wrap", gap: PlayTTSpacing.xs },
        chip: {
          borderRadius: 999,
          paddingHorizontal: PlayTTSpacing.sm,
          paddingVertical: 7,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.border,
        },
        chipActive: { backgroundColor: liquidGlassSelectionChipColor(colorScheme), borderColor: "transparent" },
        chipLabel: { fontFamily: PlayTTFontFamilies.medium, fontSize: 14 },
        counter: { fontFamily: PlayTTFontFamilies.regular, fontSize: 12, color: theme.muted, textAlign: "right" },
        radio: { flexDirection: "row", alignItems: "center", gap: PlayTTSpacing.sm, padding: PlayTTSpacing.md },
        radioDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
        radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: PlayTTColors.primary },
      }),
    [colorScheme, theme],
  )

  function set<K extends keyof CommunityProfileDraft>(key: K, value: CommunityProfileDraft[K]) {
    onChange({ ...draft, [key]: value })
  }

  function chip(key: string, label: string, active: boolean, onPress: () => void) {
    return (
      <Pressable
        key={key}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        onPress={onPress}
        style={[styles.chip, active && styles.chipActive]}
      >
        <Text style={[styles.chipLabel, { color: liquidGlassLabelColor(colorScheme, active) }]}>{label}</Text>
      </Pressable>
    )
  }

  function toggleUsualTime(key: UsualTimeKey) {
    const next = draft.usualTimes.includes(key)
      ? draft.usualTimes.filter((value) => value !== key)
      : USUAL_TIME_KEYS.filter((value) => value === key || draft.usualTimes.includes(value))
    set("usualTimes", next)
  }

  return (
    <>
      <AccountGlassSection>
        <View style={styles.row}>
          <View style={styles.copy}>
            <Text style={styles.title}>Show my card in Community</Text>
            <Text style={styles.detail}>Players at your venue can find and follow you.</Text>
          </View>
          <Switch
            value={draft.communityVisible}
            onValueChange={(value) => set("communityVisible", value)}
            accessibilityLabel="Show my card in Community"
            trackColor={{ true: PlayTTColors.primary }}
          />
        </View>
      </AccountGlassSection>

      <AccountGlassSection title="About you">
        <View style={styles.block}>
          <Input
            value={draft.bio ?? ""}
            onChangeText={(value) => set("bio", value.slice(0, BIO_MAX))}
            placeholder="e.g. Loopy forehand, always up for a long rally"
            maxLength={BIO_MAX}
            multiline
            accessibilityLabel="Bio"
          />
          <Text style={styles.counter}>
            {(draft.bio ?? "").length}/{BIO_MAX}
          </Text>
        </View>
      </AccountGlassSection>

      <AccountGlassSection title="Play style">
        <View style={styles.block}>
          <View style={styles.chips}>
            {PLAY_STYLES.map((option) =>
              chip(option.value, option.label, draft.playStyle === option.value, () =>
                set("playStyle", draft.playStyle === option.value ? null : option.value),
              ),
            )}
          </View>
          <View style={styles.chips}>
            {HANDEDNESS.map((option) =>
              chip(option.value, option.label, draft.handedness === option.value, () =>
                set("handedness", draft.handedness === option.value ? null : option.value),
              ),
            )}
          </View>
        </View>
      </AccountGlassSection>

      <AccountGlassSection title="Usually plays" description="Helps others know when to look for you.">
        <View style={styles.block}>
          <View style={styles.chips}>
            {USUAL_TIME_KEYS.map((key) =>
              chip(key, USUAL_TIME_LABELS[key], draft.usualTimes.includes(key), () => toggleUsualTime(key)),
            )}
          </View>
        </View>
      </AccountGlassSection>

      <AccountGlassSection title="Who can message me">
        <View accessibilityRole="radiogroup">
          {POLICIES.map((option, index) => {
            const active = draft.requestPolicy === option.value
            return (
              <View key={option.value}>
                {index > 0 ? <View style={styles.divider} /> : null}
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => set("requestPolicy", option.value)}
                  style={styles.radio}
                >
                  <View style={[styles.radioDot, { borderColor: active ? PlayTTColors.primary : theme.border }]}>
                    {active ? <View style={styles.radioInner} /> : null}
                  </View>
                  <View style={styles.copy}>
                    <Text style={styles.title}>{option.label}</Text>
                    <Text style={styles.detail}>{option.detail}</Text>
                  </View>
                </Pressable>
              </View>
            )
          })}
        </View>
      </AccountGlassSection>

      <AccountGlassSection>
        <View style={styles.row}>
          <View style={styles.copy}>
            <Text style={styles.title}>Show me when I&apos;m at the venue</Text>
            <Text style={styles.detail}>Adds an &quot;At the venue&quot; tag while your session is on. Off by default.</Text>
          </View>
          <Switch
            value={draft.showAtVenue}
            onValueChange={(value) => set("showAtVenue", value)}
            accessibilityLabel="Show me when I'm at the venue"
            trackColor={{ true: PlayTTColors.primary }}
          />
        </View>
      </AccountGlassSection>
    </>
  )
}
