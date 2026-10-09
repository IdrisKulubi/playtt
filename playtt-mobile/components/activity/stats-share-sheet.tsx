import { Image } from "expo-image"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  useWindowDimensions,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { captureRef, releaseCapture } from "react-native-view-shot"

import { GlassSegmentControl } from "@/components/ui/glass-segment-control"
import {
  PlayTTColors as C,
  PlayTTFontFamilies as F,
} from "@/constants/playtt-tokens"
import { useColorScheme } from "@/hooks/use-color-scheme"
import {
  saveStatsImage,
  shareStatsImage,
  shareTimeLabel,
  type StatsShareData,
} from "@/lib/stats-share"

export type { StatsShareData } from "@/lib/stats-share"

type Props = { visible: boolean; onClose: () => void; data: StatsShareData }

export function StatsShareSheet({ visible, onClose, data }: Props) {
  const dark = useColorScheme() === "dark"
  const { width } = useWindowDimensions()
  const [format, setFormat] = useState<"story" | "overlay">("story")
  const [ink, setInk] = useState<"light" | "dark">("light")
  const [includeSpending, setIncludeSpending] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{
    signature: string
    text: string
  } | null>(null)
  const [logoReady, setLogoReady] = useState<string | null>(null)
  const captureView = useRef<View>(null)
  const activeExport = useRef(false)
  const operation = useRef(0)
  const whiteInk = format === "story" || ink === "light"
  const logoKey = whiteInk ? "light" : "dark"
  const signature = JSON.stringify([
    visible,
    data,
    format,
    ink,
    includeSpending,
  ])
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
  const paper = dark ? C.background : C.productBackground
  const foreground = dark ? C.foreground : C.productForeground
  const muted = dark ? C.mutedText : C.productMuted
  const textInk = whiteInk ? C.foreground : C.productForeground
  const cardWidth = Math.min(300, width - 64)
  const art = createShareArtStyles(cardWidth / 300)

  async function exportImage(action: "share" | "save") {
    if (activeExport.current || logoReady !== logoKey || !captureView.current)
      return
    activeExport.current = true
    setBusy(true)
    setMessage("")
    const expected = signature
    const id = operation.current
    let uri: string | undefined
    const fresh = () =>
      expected === currentSignature.current && id === operation.current
    try {
      // The transparent view alone is captured: checkerboard and controls are siblings.
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
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
      if (fresh() && action === "save")
        setMessage("Saved to Photos. Your image is ready to share.")
    } catch (error) {
      if (fresh())
        setMessage(
          error instanceof Error
            ? error.message
            : "Image export failed. Please try again."
        )
    } finally {
      if (uri) releaseCapture(uri)
      activeExport.current = false
      setBusy(false)
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (!busy) onClose()
      }}
    >
      <SafeAreaView style={[s.screen, { backgroundColor: paper }]}>
        <View style={s.header}>
          <Text style={[s.title, { color: foreground }]}>Share your time</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close share preview"
            disabled={busy}
            onPress={onClose}
            style={s.close}
          >
            <Text style={[s.link, { color: foreground }]}>Done</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={s.content}>
          <Text style={[s.description, { color: muted }]}>
            A little time at the table. A story worth sharing.
          </Text>
          <View pointerEvents={busy ? "none" : "auto"}>
            <GlassSegmentControl
              value={format}
              onChange={setFormat}
              options={[
                { value: "story", label: "Story card" },
                { value: "overlay", label: "Transparent" },
              ]}
            />
          </View>
          <View
            style={[
              s.preview,
              { width: cardWidth, height: (cardWidth * 16) / 9 },
            ]}
          >
            {format === "overlay" && (
              <View
                pointerEvents="none"
                style={s.checker}
                accessibilityElementsHidden
              >
                {Array.from({ length: 24 }, (_, row) => (
                  <View key={row} style={s.checkerRow}>
                    {Array.from({ length: 14 }, (_, col) => (
                      <View
                        key={col}
                        style={{
                          flex: 1,
                          backgroundColor:
                            (row + col) % 2 ? "#526174" : "#748295",
                        }}
                      />
                    ))}
                  </View>
                ))}
              </View>
            )}
            <View
              ref={captureView}
              collapsable={false}
              style={[
                art.art,
                {
                  backgroundColor:
                    format === "story" ? C.background : "transparent",
                },
              ]}
            >
              <Image
                key={logoKey}
                source={
                  whiteInk
                    ? require("@/assets/images/logo-reversed.png")
                    : require("@/assets/images/logo.png")
                }
                contentFit="contain"
                style={art.logo}
                onDisplay={() => setLogoReady(logoKey)}
                onError={() => {
                  setLogoReady(null)
                  setMessage(
                    "The PlayTT logo could not load. Reopen this preview to try again."
                  )
                }}
                accessibilityLabel="PlayTT"
              />
              <View style={art.artMain}>
                <Text
                  maxFontSizeMultiplier={1}
                  style={[art.artTitle, { color: textInk }]}
                >
                  My time{"\n"}at the table.
                </Text>
                <Text
                  maxFontSizeMultiplier={1}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={[art.period, { color: textInk }]}
                >
                  {data.periodLabel}
                </Text>
                <View
                  style={[
                    art.rule,
                    { backgroundColor: whiteInk ? "#ffffff55" : "#0a162855" },
                  ]}
                />
                <Text
                  maxFontSizeMultiplier={1}
                  adjustsFontSizeToFit
                  numberOfLines={1}
                  style={[art.time, { color: textInk }]}
                >
                  {shareTimeLabel(data.minutes)}
                </Text>
                <Text
                  maxFontSizeMultiplier={1}
                  style={[art.artLabel, { color: textInk }]}
                >
                  Booked table time
                </Text>
                <Text
                  maxFontSizeMultiplier={1}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={[art.sessions, { color: textInk }]}
                >
                  {data.sessions.toLocaleString()}{" "}
                  {data.sessions === 1 ? "session" : "sessions"}
                </Text>
                {includeSpending && (
                  <Text
                    maxFontSizeMultiplier={1}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={[art.spending, { color: textInk }]}
                  >
                    KES{" "}
                    {data.spendingKes.toLocaleString("en-KE", {
                      maximumFractionDigits: 0,
                    })}{" "}
                    spent
                  </Text>
                )}
              </View>
              <Text
                maxFontSizeMultiplier={1}
                style={[art.footer, { color: textInk }]}
              >
                {data.preview
                  ? "SAMPLE DATA · PLAYTT PREVIEW"
                  : "theplaytt.com"}
              </Text>
            </View>
          </View>
          {format === "overlay" && (
            <>
              <View pointerEvents={busy ? "none" : "auto"}>
                <GlassSegmentControl
                  value={ink}
                  onChange={setInk}
                  options={[
                    { value: "light", label: "Light lettering" },
                    { value: "dark", label: "Dark lettering" },
                  ]}
                />
              </View>
              <Text style={[s.note, { color: muted }]}>
                The checked background is only a preview. Save the PNG and add
                it over your photo as a sticker in your story editor.
              </Text>
            </>
          )}
          <View style={s.privacy}>
            <View style={s.privacyText}>
              <Text style={[s.label, { color: foreground }]}>
                Include spending
              </Text>
              <Text style={[s.note, { color: muted }]}>
                Your spending stays private by default.
              </Text>
            </View>
            <Switch
              accessibilityLabel="Include spending in shared image"
              disabled={busy}
              value={includeSpending}
              onValueChange={setIncludeSpending}
              trackColor={{ true: C.primary }}
            />
          </View>
          {message ? (
            <Text
              accessibilityLiveRegion="polite"
              style={[s.note, { color: foreground }]}
            >
              {message}
            </Text>
          ) : null}
          {Platform.OS === "web" && (
            <Text style={[s.note, { color: muted }]}>
              Open the mobile app to save or share this image.
            </Text>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{
              disabled: busy || logoReady !== logoKey || Platform.OS === "web",
              busy,
            }}
            disabled={busy || logoReady !== logoKey || Platform.OS === "web"}
            onPress={() => void exportImage("share")}
            style={[
              s.primary,
              (busy || logoReady !== logoKey || Platform.OS === "web") &&
                s.disabled,
            ]}
          >
            {busy ? (
              <ActivityIndicator color={C.primaryForeground} />
            ) : (
              <Text style={s.primaryLabel}>Share image</Text>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy || logoReady !== logoKey || Platform.OS === "web"}
            onPress={() => void exportImage("save")}
            style={[
              s.save,
              (busy || logoReady !== logoKey || Platform.OS === "web") &&
                s.disabled,
            ]}
          >
            <Text style={[s.link, { color: foreground }]}>Save to Photos</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

// Every spatial value and text line scales together from a 300 × 533 story.
// Capture still resizes this untransformed view to the requested 1080 × 1920 PNG.
function createShareArtStyles(scale: number) {
  return StyleSheet.create({
    art: { flex: 1, padding: 26 * scale, justifyContent: "space-between" },
    logo: { width: 100 * scale, height: 29 * scale },
    artMain: { gap: 6 * scale },
    artTitle: {
      fontFamily: F.semiBold,
      fontSize: 35 * scale,
      lineHeight: 37 * scale,
      letterSpacing: -0.9 * scale,
    },
    period: {
      fontFamily: F.medium,
      fontSize: 13 * scale,
      lineHeight: 16 * scale,
      marginTop: 12 * scale,
    },
    rule: { height: scale, marginVertical: 14 * scale },
    time: {
      fontFamily: F.semiBold,
      fontSize: 47 * scale,
      lineHeight: 57 * scale,
      letterSpacing: -1.2 * scale,
    },
    artLabel: {
      fontFamily: F.regular,
      fontSize: 12 * scale,
      lineHeight: 16 * scale,
    },
    sessions: {
      fontFamily: F.medium,
      fontSize: 21 * scale,
      lineHeight: 26 * scale,
      marginTop: 15 * scale,
    },
    spending: {
      fontFamily: F.medium,
      fontSize: 14 * scale,
      lineHeight: 18 * scale,
      marginTop: 8 * scale,
    },
    footer: {
      fontFamily: F.medium,
      fontSize: 10 * scale,
      lineHeight: 14 * scale,
      letterSpacing: 0.5 * scale,
    },
  })
}
const s = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  title: { fontFamily: F.semiBold, fontSize: 24, letterSpacing: -0.5 },
  close: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  content: { paddingHorizontal: 24, paddingBottom: 32, gap: 18 },
  description: { fontFamily: F.regular, fontSize: 15, lineHeight: 22 },
  preview: { alignSelf: "center", overflow: "hidden", borderRadius: 12 },
  checker: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  checkerRow: { flex: 1, flexDirection: "row" },
  privacy: { flexDirection: "row", gap: 12, alignItems: "center" },
  privacyText: { flex: 1, gap: 4 },
  label: { fontFamily: F.medium, fontSize: 15 },
  note: { fontFamily: F.regular, fontSize: 13, lineHeight: 19 },
  primary: {
    minHeight: 50,
    borderRadius: 25,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryLabel: {
    color: C.primaryForeground,
    fontFamily: F.semiBold,
    fontSize: 16,
  },
  link: { fontFamily: F.medium, fontSize: 15 },
  save: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.45 },
})
