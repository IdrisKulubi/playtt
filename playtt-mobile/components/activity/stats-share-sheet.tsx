import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Platform, StyleSheet, Text, View, useWindowDimensions, type HostInstance } from "react-native"
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated"
import { captureRef, releaseCapture } from "react-native-view-shot"

import { ActivityRing } from "@/components/activity/activity-ring"
import { Button } from "@/components/kit/button"
import { ListRow } from "@/components/kit/list-row"
import { ListSection } from "@/components/kit/list-section"
import { Sheet } from "@/components/kit/sheet"
import { AppText } from "@/components/ui/app-text"
import { SegmentedControl } from "@/components/kit/segmented-control"
import { spring } from "@/constants/motion"
import { PlayTTColors as C, PlayTTSpacing } from "@/constants/playtt-tokens"
import { haptics } from "@/lib/haptics"
import { toast } from "@/lib/toast"
import { saveStatsImage, shareStatsImage, shareTimeLabel, type StatsShareData } from "@/lib/stats-share"

export type { StatsShareData } from "@/lib/stats-share"

type Props = { visible: boolean; onClose: () => void; data: StatsShareData }

/** The lighter cyan the ring's second lap uses on the dark story card. */
const RING_OVERLAP = "#7FDBFF"

export function StatsShareSheet({ visible, onClose, data }: Props) {
  const { width } = useWindowDimensions()
  const reducedMotion = useReducedMotion()
  const [format, setFormat] = useState<"story" | "overlay">("story")
  const [ink, setInk] = useState<"light" | "dark">("light")
  const [includeSpending, setIncludeSpending] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ signature: string; text: string } | null>(null)
  const [logoReady, setLogoReady] = useState<string | null>(null)
  const captureView = useRef<HostInstance>(null)
  const activeExport = useRef(false)
  const operation = useRef(0)
  const whiteInk = format === "story" || ink === "light"
  const logoKey = whiteInk ? "light" : "dark"
  const signature = JSON.stringify([visible, data, format, ink, includeSpending])
  const message = status?.signature === signature ? status.text : ""
  const setMessage = (text: string) => setStatus({ signature, text })
  const currentSignature = useRef(signature)
  useLayoutEffect(() => {
    currentSignature.current = signature
    operation.current += 1
  }, [signature])
  useEffect(
    () => () => {
      operation.current += 1
    },
    []
  )

  // The card arrives like a photo being set down: it rises, grows and straightens.
  const enter = useSharedValue(reducedMotion ? 1 : 0)
  useEffect(() => {
    if (reducedMotion) {
      enter.set(1)
      return
    }
    if (visible) {
      enter.set(0)
      enter.set(withDelay(160, withSpring(1, spring("flick"))))
    } else {
      enter.set(0)
    }
  }, [visible, reducedMotion, enter])
  const cardStyle = useAnimatedStyle(() => ({
    opacity: Math.min(enter.get() * 1.6, 1),
    transform: [
      { translateY: (1 - enter.get()) * 48 },
      { scale: 0.88 + enter.get() * 0.12 },
      { rotate: `${(1 - enter.get()) * -5}deg` },
    ],
  }))

  const textInk = whiteInk ? C.foreground : C.productForeground
  const cardWidth = Math.min(300, width - 64)
  const art = createShareArtStyles(cardWidth / 300)
  const scale = cardWidth / 300
  const ringSize = 196 * scale
  const percent = data.goalMinutes > 0 ? Math.round((data.minutes / data.goalMinutes) * 100) : 0
  const exportReady = logoReady === logoKey && !busy && Platform.OS !== "web"

  async function exportImage(action: "share" | "save") {
    if (activeExport.current || logoReady !== logoKey || !captureView.current) return
    activeExport.current = true
    setBusy(true)
    setMessage("")
    const expected = signature
    const id = operation.current
    let uri: string | undefined
    const fresh = () => expected === currentSignature.current && id === operation.current
    try {
      // The transparent view alone is captured: checkerboard and controls are siblings.
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      if (!fresh()) return
      uri = await captureRef(captureView, {
        format: "png",
        result: "tmpfile",
        width: 1080,
        height: 1920,
        quality: 1,
      })
      if (!fresh()) return
      if (action === "share") await shareStatsImage(uri, fresh)
      else await saveStatsImage(uri, fresh)
      if (fresh() && action === "save") {
        haptics.success()
        // The sheet is a modal that covers the toast, so let it slide away first.
        onClose()
        setTimeout(() => toast.success("Saved to Photos"), 350)
      }
    } catch (error) {
      if (fresh()) setMessage(error instanceof Error ? error.message : "Image export failed. Please try again.")
    } finally {
      if (uri) releaseCapture(uri)
      activeExport.current = false
      setBusy(false)
    }
  }

  return (
    <Sheet visible={visible} title="Share your story" detents={["large"]} scrollable dismissible={!busy} onClose={onClose}>
      <View style={styles.stack}>
        <AppText variant="body" color="secondaryLabel">
          A little time at the table. A story worth sharing.
        </AppText>

        <View pointerEvents={busy ? "none" : "auto"}>
          <SegmentedControl
            label="Card style"
            value={format}
            onChange={setFormat}
            options={[
              { value: "story", label: "Story card" },
              { value: "overlay", label: "Transparent" },
            ]}
          />
        </View>

        <Animated.View style={[styles.preview, { width: cardWidth, height: (cardWidth * 16) / 9 }, cardStyle]}>
          {format === "overlay" && (
            <View pointerEvents="none" style={styles.checker} accessibilityElementsHidden>
              {Array.from({ length: 24 }, (_, row) => (
                <View key={row} style={styles.checkerRow}>
                  {Array.from({ length: 14 }, (_, col) => (
                    <View key={col} style={{ flex: 1, backgroundColor: (row + col) % 2 ? "#526174" : "#748295" }} />
                  ))}
                </View>
              ))}
            </View>
          )}
          <Animated.View key={format} entering={reducedMotion ? undefined : FadeIn.duration(220)} exiting={reducedMotion ? undefined : FadeOut.duration(120)} style={styles.fill}>
            <View
              ref={captureView}
              collapsable={false}
              style={[art.art, { backgroundColor: format === "story" ? C.background : "transparent" }]}
            >
              {format === "story" ? (
                <>
                  <LinearGradient
                    colors={["#0F3557", "#0A1D33", C.background]}
                    locations={[0, 0.45, 1]}
                    style={StyleSheet.absoluteFill}
                  />
                </>
              ) : null}

              <View style={art.top}>
                <Image
                  key={logoKey}
                  source={whiteInk ? require("@/assets/images/logo-reversed.png") : require("@/assets/images/logo.png")}
                  contentFit="contain"
                  style={art.logo}
                  onDisplay={() => setLogoReady(logoKey)}
                  onError={() => {
                    setLogoReady(null)
                    setMessage("The PlayTT logo could not load. Reopen this preview to try again.")
                  }}
                  accessibilityLabel="PlayTT"
                />
                <Text maxFontSizeMultiplier={1} numberOfLines={1} adjustsFontSizeToFit style={[art.period, { color: textInk }]}>
                  {data.periodLabel}
                </Text>
              </View>

              <Text maxFontSizeMultiplier={1} style={[art.artTitle, { color: textInk }]}>
                My time{"\n"}at the table.
              </Text>

              <View style={art.ringBlock}>
                <ActivityRing
                  size={ringSize}
                  lineWidth={34 * scale}
                  progress={data.goalMinutes > 0 ? data.minutes / data.goalMinutes : 0}
                  color={C.primary}
                  overlapColor={RING_OVERLAP}
                  capIconColor={C.primaryForeground}
                  animated={false}
                />
                <View style={art.ringCenter} pointerEvents="none">
                  <Text maxFontSizeMultiplier={1} adjustsFontSizeToFit numberOfLines={1} style={[art.time, { color: textInk }]}>
                    {shareTimeLabel(data.minutes)}
                  </Text>
                  <Text maxFontSizeMultiplier={1} style={[art.artLabel, { color: textInk }]}>
                    at the table
                  </Text>
                </View>
              </View>

              <View style={art.stats}>
                <View style={art.stat}>
                  <Text maxFontSizeMultiplier={1} adjustsFontSizeToFit numberOfLines={1} style={[art.statValue, { color: textInk }]}>
                    {data.sessions.toLocaleString()}
                  </Text>
                  <Text maxFontSizeMultiplier={1} style={[art.artLabel, { color: textInk }]}>
                    {data.sessions === 1 ? "session" : "sessions"}
                  </Text>
                </View>
                <View style={[art.statDivider, { backgroundColor: whiteInk ? "#ffffff33" : "#0a162833" }]} />
                <View style={art.stat}>
                  <Text maxFontSizeMultiplier={1} adjustsFontSizeToFit numberOfLines={1} style={[art.statValue, { color: textInk }]}>
                    {percent}%
                  </Text>
                  <Text maxFontSizeMultiplier={1} style={[art.artLabel, { color: textInk }]}>
                    of my goal
                  </Text>
                </View>
                {includeSpending ? (
                  <>
                    <View style={[art.statDivider, { backgroundColor: whiteInk ? "#ffffff33" : "#0a162833" }]} />
                    <View style={art.stat}>
                      <Text maxFontSizeMultiplier={1} adjustsFontSizeToFit numberOfLines={1} style={[art.statValue, { color: textInk }]}>
                        {data.spendingKes.toLocaleString("en-KE", { maximumFractionDigits: 0 })}
                      </Text>
                      <Text maxFontSizeMultiplier={1} style={[art.artLabel, { color: textInk }]}>
                        KES spent
                      </Text>
                    </View>
                  </>
                ) : null}
              </View>

              <StoryBars values={data.bars} height={44 * scale} color={C.primary} inactive={whiteInk ? "#ffffff33" : "#0a162833"} />

              <Text maxFontSizeMultiplier={1} style={[art.footer, { color: textInk }]}>
                {data.preview ? "SAMPLE DATA · PLAYTT PREVIEW" : "theplaytt.com"}
              </Text>
            </View>
          </Animated.View>
        </Animated.View>

        {format === "overlay" && (
          <>
            <View pointerEvents={busy ? "none" : "auto"}>
              <SegmentedControl
                label="Lettering"
                value={ink}
                onChange={setInk}
                options={[
                  { value: "light", label: "Light lettering" },
                  { value: "dark", label: "Dark lettering" },
                ]}
              />
            </View>
            <AppText variant="footnote" color="secondaryLabel">
              The checked background is only a preview. Save the PNG and add it over your photo as a sticker in your story editor.
            </AppText>
          </>
        )}

        <ListSection footer="Your spending stays private by default.">
          <ListRow
            title="Include spending"
            accessory={{ kind: "toggle", value: includeSpending, onValueChange: setIncludeSpending }}
          />
        </ListSection>

        {message ? (
          <AppText variant="subheadline" accessibilityLiveRegion="polite">
            {message}
          </AppText>
        ) : null}
        {Platform.OS === "web" && (
          <AppText variant="footnote" color="secondaryLabel">
            Open the mobile app to save or share this image.
          </AppText>
        )}

        <Button label="Share image" loading={busy} disabled={!exportReady && !busy} onPress={() => void exportImage("share")} />
        <Button label="Save to Photos" variant="secondary" disabled={!exportReady} onPress={() => void exportImage("save")} />
      </View>
    </Sheet>
  )
}

/** The period's table time as little bars; static, so exports match the preview. */
function StoryBars({ values, height, color, inactive }: { values: number[]; height: number; color: string; inactive: string }) {
  const max = Math.max(...values, 1)

  return (
    <View style={[storyBars.row, { height }]} accessibilityElementsHidden>
      {values.map((value, index) => (
        <View
          key={index}
          style={[
            storyBars.bar,
            { height: Math.max(3, (value / max) * height), backgroundColor: value ? color : inactive },
          ]}
        />
      ))}
    </View>
  )
}

const storyBars = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", gap: 2 },
  bar: { flex: 1, borderRadius: 2 },
})

// Every spatial value and text line scales together from a 300 × 533 story.
// Capture still resizes this untransformed view to the requested 1080 × 1920 PNG.
function createShareArtStyles(scale: number) {
  return StyleSheet.create({
    art: { flex: 1, padding: 24 * scale, justifyContent: "space-between", overflow: "hidden" },
    top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 * scale },
    logo: { width: 92 * scale, height: 27 * scale },
    period: { flexShrink: 1, fontWeight: "500", fontSize: 12 * scale, lineHeight: 16 * scale, opacity: 0.85 },
    artTitle: {
      fontWeight: "700",
      fontSize: 31 * scale,
      lineHeight: 33 * scale,
      letterSpacing: -0.8 * scale,
    },
    ringBlock: { alignSelf: "center", alignItems: "center", justifyContent: "center" },
    ringCenter: { position: "absolute", alignItems: "center", paddingHorizontal: 40 * scale },
    time: { fontWeight: "700", fontSize: 34 * scale, lineHeight: 40 * scale, letterSpacing: -1 * scale },
    artLabel: { fontWeight: "400", fontSize: 11 * scale, lineHeight: 15 * scale, opacity: 0.8 },
    stats: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16 * scale },
    stat: { alignItems: "center", minWidth: 60 * scale, maxWidth: 90 * scale },
    statValue: { fontWeight: "700", fontSize: 22 * scale, lineHeight: 27 * scale },
    statDivider: { width: 1, height: 30 * scale },
    footer: {
      fontWeight: "600",
      fontSize: 10 * scale,
      lineHeight: 14 * scale,
      letterSpacing: 0.5 * scale,
      opacity: 0.8,
    },
  })
}

const styles = StyleSheet.create({
  stack: { gap: PlayTTSpacing.md },
  fill: { flex: 1 },
  preview: { alignSelf: "center", overflow: "hidden", borderRadius: 20, borderCurve: "continuous" },
  checker: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  checkerRow: { flex: 1, flexDirection: "row" },
})
