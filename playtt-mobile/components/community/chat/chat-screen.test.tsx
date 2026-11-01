import React from "react"
import { act, fireEvent, render, waitFor } from "@testing-library/react-native"

import CommunityChatScreen from "@/app/(app)/community/chat/[conversationId]"
import { CHAT_POLL_MS } from "@/hooks/use-community-chat"
import {
  acceptConversation,
  fetchMessages,
  markConversationRead,
  sendCommunityMessage,
} from "@/lib/community-chat-api"
import { fetchSharedBookings, giveKudos, joinSharedBooking } from "@/lib/community-api"
import type { CommunityConversation, CommunityMessage, CommunitySharedBooking } from "@/lib/community-types"

jest.mock("expo-router", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useEffect } = require("react")
  return {
    router: { push: jest.fn(), back: jest.fn() },
    useLocalSearchParams: () => ({ conversationId: "c1" }),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
  }
})
jest.mock("@/lib/community-chat-api", () => ({
  fetchMessages: jest.fn(),
  sendCommunityMessage: jest.fn(),
  markConversationRead: jest.fn(() => Promise.resolve()),
  acceptConversation: jest.fn(),
  leaveConversation: jest.fn(),
  newClientMessageId: jest.fn(() => "m-test-0001"),
}))
jest.mock("@/lib/community-api", () => ({
  blockPlayer: jest.fn(),
  reportPlayer: jest.fn(),
  fetchSharedBookings: jest.fn(() => Promise.resolve([])),
  joinSharedBooking: jest.fn(),
  leaveSharedBooking: jest.fn(),
  giveKudos: jest.fn(),
}))
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "light" },
  NotificationFeedbackType: { Success: "success" },
}))
jest.mock("@/lib/booking-api", () => ({ fetchMyBookings: jest.fn(() => Promise.resolve([])) }))
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock("react-native-reanimated", () => require("@/test/reanimated-mock"))
jest.mock("react-native-safe-area-context", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require("react-native")
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  }
})
jest.mock("@/hooks/use-color-scheme", () => ({ useColorScheme: () => "dark" }))
jest.mock("expo-image", () => ({ Image: () => null }))
jest.mock("@/components/navigation/screen-back-button", () => ({ ScreenBackButton: () => null }))
jest.mock("@/components/ui/bottom-sheet", () => ({
  BottomSheet: ({ children, visible }: { children: React.ReactNode; visible: boolean }) =>
    visible ? children : null,
}))
jest.mock("phosphor-react-native/src/icons/CalendarCheck", () => ({ CalendarCheck: () => null }))
jest.mock("phosphor-react-native/src/icons/DotsThreeVertical", () => ({ DotsThreeVertical: () => null }))
jest.mock("phosphor-react-native/src/icons/Fire", () => ({ Fire: () => null }))
jest.mock("phosphor-react-native/src/icons/Handshake", () => ({ Handshake: () => null }))
jest.mock("phosphor-react-native/src/icons/Medal", () => ({ Medal: () => null }))
jest.mock("phosphor-react-native/src/icons/Star", () => ({ Star: () => null }))
jest.mock("phosphor-react-native/src/icons/CheckCircle", () => ({ CheckCircle: () => null }))
jest.mock("phosphor-react-native/src/icons/Plus", () => ({ Plus: () => null }))

const getMessages = jest.mocked(fetchMessages)
const send = jest.mocked(sendCommunityMessage)
const markRead = jest.mocked(markConversationRead)
const accept = jest.mocked(acceptConversation)

const NO_STATS = { matches: null, winRate: null, reliability: null, streakWeeks: null, kudos: null, hours: null }

function message(seq: number, overrides: Partial<CommunityMessage> = {}): CommunityMessage {
  return {
    id: `msg-${seq}`,
    seq,
    conversationId: "c1",
    senderId: "user_amara",
    mine: false,
    kind: "text",
    body: `Message ${seq}`,
    payload: null,
    clientMessageId: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function conversation(overrides: Partial<CommunityConversation> = {}): CommunityConversation {
  return {
    id: "c1",
    type: "direct",
    state: "active",
    player: {
      id: "user_amara",
      displayName: "Amara K.",
      image: null,
      skillLevel: "intermediate",
      playStyle: null,
      handedness: null,
      bio: null,
      usualTimes: [],
      foundingPlayer: false,
      availability: null,
      relationship: { following: true, followsYou: true, rallyPartner: true, blockedByYou: false, canMessage: true },
      stats: NO_STATS,
      badges: [],
    },
    lastMessage: null,
    unreadCount: 0,
    otherLastReadSeq: 0,
    canSend: true,
    pendingRequest: null,
    ...overrides,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
})

afterEach(() => {
  jest.useRealTimers()
})

test("loads the chat, sends optimistically and replaces the pending copy", async () => {
  getMessages.mockResolvedValueOnce({
    messages: [message(1, { body: "Free at 7?" })],
    hasMore: false,
    otherLastReadSeq: 0,
    conversation: conversation(),
  })
  let resolveSend: (value: CommunityMessage) => void = () => undefined
  send.mockImplementation(() => new Promise((resolve) => (resolveSend = resolve)))

  const screen = await render(<CommunityChatScreen />)
  expect(await screen.findByText("Free at 7?")).toBeTruthy()
  await waitFor(() => expect(markRead).toHaveBeenCalledWith("c1", 1))

  await fireEvent.changeText(screen.getByLabelText("Message"), "Yes, 7 works")
  await fireEvent.press(screen.getByLabelText("Send message"))

  expect(screen.getByText("Yes, 7 works")).toBeTruthy()
  expect(screen.getByText("Sending…")).toBeTruthy()
  expect(send).toHaveBeenCalledWith("c1", { kind: "text", body: "Yes, 7 works", clientMessageId: "m-test-0001" })

  await act(async () => {
    resolveSend(message(2, { mine: true, senderId: "me", body: "Yes, 7 works", clientMessageId: "m-test-0001" }))
  })
  expect(screen.queryByText("Sending…")).toBeNull()
  expect(screen.getAllByText("Yes, 7 works")).toHaveLength(1)
})

test("polls with after= the newest message and merges replies", async () => {
  jest.useFakeTimers()
  getMessages
    .mockResolvedValueOnce({ messages: [message(3)], hasMore: false, otherLastReadSeq: 0, conversation: conversation() })
    .mockResolvedValue({
      messages: [message(4, { body: "See you there" })],
      hasMore: false,
      otherLastReadSeq: 3,
      conversation: null,
    })

  const screen = await render(<CommunityChatScreen />)
  expect(await screen.findByText("Message 3")).toBeTruthy()

  await act(async () => {
    jest.advanceTimersByTime(CHAT_POLL_MS)
  })

  await waitFor(() => expect(getMessages).toHaveBeenCalledWith("c1", { after: 3 }))
  expect(await screen.findByText("See you there")).toBeTruthy()
})

test("quick replies send as quick_reply messages", async () => {
  getMessages.mockResolvedValueOnce({ messages: [], hasMore: false, otherLastReadSeq: 0, conversation: conversation() })
  send.mockResolvedValue(message(1, { mine: true, kind: "quick_reply", body: "I'll book the table", clientMessageId: "m-test-0001" }))

  const screen = await render(<CommunityChatScreen />)
  await fireEvent.press(await screen.findByLabelText("Send quick reply: I'll book the table"))

  expect(send).toHaveBeenCalledWith("c1", {
    kind: "quick_reply",
    body: "I'll book the table",
    clientMessageId: "m-test-0001",
  })
})

test("message requests show Accept and are not marked read until accepted", async () => {
  getMessages.mockResolvedValueOnce({
    messages: [message(5, { body: "Fancy a game tonight?" })],
    hasMore: false,
    otherLastReadSeq: 0,
    conversation: conversation({ state: "request" }),
  })
  accept.mockResolvedValue(conversation({ state: "active" }))

  const screen = await render(<CommunityChatScreen />)
  expect(await screen.findByText("Amara K. wants to play")).toBeTruthy()
  expect(screen.queryByLabelText("Message")).toBeNull()
  expect(markRead).not.toHaveBeenCalled()

  await fireEvent.press(screen.getByText("Accept"))
  await waitFor(() => expect(markRead).toHaveBeenCalledWith("c1", 5))
  expect(await screen.findByLabelText("Message")).toBeTruthy()
})

const fetchShared = jest.mocked(fetchSharedBookings)
const join = jest.mocked(joinSharedBooking)
const kudos = jest.mocked(giveKudos)

const LATER = new Date(Date.now() + 3 * 60 * 60_000).toISOString()

test("the partner can join a booking card the host shared", async () => {
  getMessages.mockResolvedValue({
    messages: [
      message(7, {
        kind: "booking_card",
        body: "Shared a booking",
        payload: { bookingId: "b-1", startsAt: LATER, endsAt: LATER, resourceName: "Table 1", locationName: "Parklands" },
      }),
    ],
    hasMore: false,
    otherLastReadSeq: 0,
    conversation: conversation(),
  })
  join.mockResolvedValue([])

  const screen = await render(<CommunityChatScreen />)
  await fireEvent.press(await screen.findByLabelText("I'm in: join this booking"))
  expect(join).toHaveBeenCalledWith("b-1", "c1")
})

test("the kudos prompt opens kudos for the shared booking and Play again prefills a rematch", async () => {
  const booking: CommunitySharedBooking = {
    bookingId: "b-2",
    role: "guest",
    hostId: "user_amara",
    conversationId: "c1",
    startsAt: "2026-10-28T16:00:00.000Z",
    endsAt: "2026-10-28T17:00:00.000Z",
    resourceName: "Table 1",
    locationName: "Parklands",
    phase: "ended",
    kudosOpen: true,
    partners: [],
    kudosGiven: {},
  }
  fetchShared.mockResolvedValue([booking])
  getMessages.mockResolvedValue({
    messages: [message(8, { kind: "kudos_prompt", senderId: null, body: "How was your match?", payload: { bookingId: "b-2" } })],
    hasMore: false,
    otherLastReadSeq: 0,
    conversation: conversation(),
  })
  kudos.mockResolvedValue([booking])

  const screen = await render(<CommunityChatScreen />)
  await fireEvent.press(await screen.findByText("Play again"))
  expect(screen.getByDisplayValue("Rematch? 🏓")).toBeTruthy()

  await waitFor(() => expect(fetchShared).toHaveBeenCalled())
  await fireEvent.press(screen.getByText("Give kudos"))
  await fireEvent.press(await screen.findByLabelText("Great rallies"))
  await fireEvent.press(screen.getByText("Send 1 kudos"))
  await waitFor(() => expect(kudos).toHaveBeenCalledWith("b-2", "user_amara", ["great_rallies"]))
})
