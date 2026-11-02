import React from "react"
import { fireEvent, render, waitFor } from "@testing-library/react-native"

import CommunityGroupScreen from "@/app/(app)/community/group/[groupId]"
import { fetchGroupMessages, sendGroupMessage } from "@/lib/community-chat-api"
import type { CommunityGroup, CommunityGroupMessage } from "@/lib/community-types"

jest.mock("expo-router", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useEffect } = require("react")
  return {
    router: { push: jest.fn(), back: jest.fn() },
    useLocalSearchParams: () => ({ groupId: "g1" }),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
  }
})
jest.mock("@/lib/community-chat-api", () => ({
  fetchGroupMessages: jest.fn(),
  sendGroupMessage: jest.fn(),
  markGroupRead: jest.fn(() => Promise.resolve()),
  muteGroup: jest.fn(),
  leaveGroup: jest.fn(),
  removeGroupMember: jest.fn(),
  newClientMessageId: jest.fn(() => "m-group-0001"),
}))
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock("react-native-reanimated", () => require("@/test/reanimated-mock"))
jest.mock("react-native-safe-area-context", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require("react-native")
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }
})
jest.mock("@/hooks/use-color-scheme", () => ({ useColorScheme: () => "dark" }))
jest.mock("expo-haptics", () => ({ impactAsync: jest.fn(() => Promise.resolve()), ImpactFeedbackStyle: { Light: "light" } }))
jest.mock("expo-image", () => ({ Image: () => null }))
jest.mock("@/components/navigation/screen-back-button", () => ({ ScreenBackButton: () => null }))
jest.mock("@/components/ui/bottom-sheet", () => ({
  BottomSheet: ({ children, visible }: { children: React.ReactNode; visible: boolean }) => (visible ? children : null),
}))
jest.mock("phosphor-react-native/src/icons/CalendarCheck", () => ({ CalendarCheck: () => null }))
jest.mock("phosphor-react-native/src/icons/DotsThreeVertical", () => ({ DotsThreeVertical: () => null }))
jest.mock("phosphor-react-native/src/icons/Plus", () => ({ Plus: () => null }))
jest.mock("phosphor-react-native/src/icons/UsersThree", () => ({ UsersThree: () => null }))
jest.mock("phosphor-react-native/src/icons/Fire", () => ({ Fire: () => null }))
jest.mock("phosphor-react-native/src/icons/Handshake", () => ({ Handshake: () => null }))
jest.mock("phosphor-react-native/src/icons/Medal", () => ({ Medal: () => null }))
jest.mock("phosphor-react-native/src/icons/Star", () => ({ Star: () => null }))
jest.mock("phosphor-react-native/src/icons/CheckCircle", () => ({ CheckCircle: () => null }))

const getMessages = jest.mocked(fetchGroupMessages)
const send = jest.mocked(sendGroupMessage)

function message(seq: number, overrides: Partial<CommunityGroupMessage> = {}): CommunityGroupMessage {
  return {
    id: `gm-${seq}`,
    seq,
    conversationId: "g1",
    senderId: "user_amara",
    mine: false,
    kind: "text",
    body: `Message ${seq}`,
    payload: null,
    clientMessageId: null,
    createdAt: new Date().toISOString(),
    senderName: "Amara K.",
    ...overrides,
  }
}

const GROUP: CommunityGroup = {
  id: "g1",
  type: "group",
  title: "2v2 with Amara K.",
  description: null,
  startsAt: null,
  maxMembers: 4,
  memberCount: 3,
  members: [],
  myRole: "member",
  mutedUntil: null,
  closed: false,
  lastMessage: null,
  unreadCount: 0,
}

beforeEach(() => jest.clearAllMocks())

test("group chats show who said what and send to the group", async () => {
  getMessages.mockResolvedValue({ messages: [message(1, { body: "Who's booking?" })], hasMore: false, group: GROUP })
  send.mockResolvedValue(message(2, { mine: true, senderId: "me", body: "Me, Table 2", clientMessageId: "m-group-0001" }))

  const screen = await render(<CommunityGroupScreen />)
  expect(await screen.findByText("Who's booking?")).toBeTruthy()
  expect(screen.getByText("Amara K.")).toBeTruthy()
  expect(screen.getByText("2v2 with Amara K.")).toBeTruthy()
  expect(screen.getByText("3 of 4 players")).toBeTruthy()

  await fireEvent.changeText(screen.getByLabelText("Message"), "Me, Table 2")
  await fireEvent.press(screen.getByLabelText("Send message"))
  await waitFor(() =>
    expect(send).toHaveBeenCalledWith("g1", { kind: "text", body: "Me, Table 2", clientMessageId: "m-group-0001" }),
  )
  // Groups have no booking actions.
  expect(screen.queryByLabelText("Book or share a table")).toBeNull()
})

test("closed groups can't be written to", async () => {
  getMessages.mockResolvedValue({ messages: [], hasMore: false, group: { ...GROUP, closed: true } })
  const screen = await render(<CommunityGroupScreen />)
  expect(await screen.findByText("This group is closed.")).toBeTruthy()
  expect(screen.queryByLabelText("Message")).toBeNull()
})
