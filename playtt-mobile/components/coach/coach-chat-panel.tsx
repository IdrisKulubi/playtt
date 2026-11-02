import { useCallback, useMemo, useRef, useState } from "react"
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { CoachChatComposer } from "@/components/coach/coach-chat-composer"
import { CoachChatMessageBubble } from "@/components/coach/coach-chat-message"
import { CoachChatQuickPrompts } from "@/components/coach/coach-chat-quick-prompts"
import { CoachChatTypingIndicator } from "@/components/coach/coach-chat-typing-indicator"
import { AppText } from "@/components/ui/app-text"
import { PreviewBadge } from "@/components/ui/preview-badge"
import { KitLayout } from "@/constants/kit-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { sendCoachChatMessage } from "@/lib/coach-chat-api"
import {
  createPlayerMessage,
  INITIAL_COACH_MESSAGES,
  QUICK_PROMPTS,
  type CoachChatMessage,
  type CoachQuickPrompt,
} from "@/lib/mock/mock-coach-chat"
import { toast } from "@/lib/toast"
import { useAppTheme } from "@/hooks/use-app-theme"

type ListItem =
  | { type: "message"; message: CoachChatMessage }
  | { type: "typing" }

export function CoachChatPanel() {
  const { colors } = useAppTheme()
  const insets = useSafeAreaInsets()
  const listRef = useRef<FlatList<ListItem>>(null)
  const [messages, setMessages] = useState<CoachChatMessage[]>(
    INITIAL_COACH_MESSAGES,
  )
  const [draft, setDraft] = useState("")
  const [isSending, setIsSending] = useState(false)

  const listData = useMemo<ListItem[]>(() => {
    const items: ListItem[] = messages.map((message) => ({
      type: "message",
      message,
    }))
    if (isSending) {
      items.push({ type: "typing" })
    }
    return items
  }, [isSending, messages])

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true })
    })
  }, [])

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isSending) {
        return
      }

      const playerMessage = createPlayerMessage(trimmed)
      const nextHistory = [...messages, playerMessage]

      setMessages(nextHistory)
      setDraft("")
      setIsSending(true)
      scrollToEnd()

      try {
        const reply = await sendCoachChatMessage(trimmed, messages)
        setMessages((current) => [...current, reply])
        scrollToEnd()
      } catch (error) {
        setMessages(messages)
        setDraft(trimmed)
        toast.apiError(error, "Could not reach Coach. Try again.")
      } finally {
        setIsSending(false)
      }
    },
    [isSending, messages, scrollToEnd],
  )

  function handleQuickPrompt(prompt: CoachQuickPrompt) {
    void sendMessage(prompt.message)
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
    >
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <AppText variant="title3" accessibilityRole="header">
            Ask your coach
          </AppText>
          <PreviewBadge />
        </View>
        <AppText variant="callout" color="secondaryLabel">
          Ask about technique, drills, or your last game.
        </AppText>
      </View>

      <FlatList
        ref={listRef}
        style={styles.flex}
        data={listData}
        keyExtractor={(item, index) =>
          item.type === "typing" ? `typing-${index}` : item.message.id
        }
        renderItem={({ item }) =>
          item.type === "typing" ? (
            <CoachChatTypingIndicator />
          ) : (
            <CoachChatMessageBubble message={item.message} />
          )
        }
        contentContainerStyle={styles.list}
        onContentSizeChange={scrollToEnd}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + PlayTTSpacing.xs, backgroundColor: colors.background }]}>
        <CoachChatQuickPrompts
          prompts={QUICK_PROMPTS}
          onSelect={handleQuickPrompt}
          disabled={isSending}
        />
        <CoachChatComposer
          value={draft}
          onChange={setDraft}
          onSend={() => void sendMessage(draft)}
          disabled={isSending}
          isSending={isSending}
        />
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: {
    gap: 2,
    paddingHorizontal: KitLayout.screenGutter,
    paddingTop: PlayTTSpacing.xs,
    paddingBottom: PlayTTSpacing.xs,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: PlayTTSpacing.sm },
  list: { flexGrow: 1, justifyContent: "flex-end", paddingVertical: PlayTTSpacing.xs },
  footer: { flexShrink: 0, gap: PlayTTSpacing.xs },
})
