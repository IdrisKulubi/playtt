import { apiFetch } from "@/lib/api-client"
import {
  createPlayerMessage,
  resolveMockCoachReply,
  type CoachChatMessage,
} from "@/lib/mock/mock-coach-chat"
import { USE_MOCK_PLAYER_DATA } from "@/lib/mock/mock-config"

type CoachChatResponse = {
  data?: {
    message: CoachChatMessage
  }
}

const MOCK_REPLY_DELAY_MS_MIN = 600
const MOCK_REPLY_DELAY_MS_MAX = 1200

function mockReplyDelay() {
  const span = MOCK_REPLY_DELAY_MS_MAX - MOCK_REPLY_DELAY_MS_MIN
  return MOCK_REPLY_DELAY_MS_MIN + Math.floor(Math.random() * span)
}

export async function sendCoachChatMessage(
  message: string,
  history: CoachChatMessage[],
): Promise<CoachChatMessage> {
  const trimmed = message.trim()
  if (!trimmed) {
    throw new Error("Message cannot be empty.")
  }

  if (USE_MOCK_PLAYER_DATA) {
    await new Promise((resolve) => setTimeout(resolve, mockReplyDelay()))
    return resolveMockCoachReply(trimmed, [
      ...history,
      createPlayerMessage(trimmed),
    ])
  }

  const response = await apiFetch<CoachChatResponse>("/api/coach/chat", {
    method: "POST",
    body: JSON.stringify({
      message: trimmed,
      history: history.map(({ role, text }) => ({ role, text })),
    }),
  })

  if (!response.data?.message) {
    throw new Error("Coach chat response was empty.")
  }

  return response.data.message
}
