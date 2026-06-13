export type CommunityPlayer = {
  id: string
  name: string
  skillLevel: string
  preferredTime: string
  venue: string
  bio: string
}

export type CommunityPlayRequest = {
  id: string
  playerName: string
  skillLevel: string
  preferredTime: string
  venue: string
  status: "open" | "pending"
}

export const MOCK_COMMUNITY_PLAYERS: CommunityPlayer[] = [
  {
    id: "p1",
    name: "Amara K.",
    skillLevel: "Intermediate",
    preferredTime: "Weekday evenings",
    venue: "PlayTT Hurlingham",
    bio: "Looking for consistent rally partners. Prefer best-of-five sets.",
  },
  {
    id: "p2",
    name: "James O.",
    skillLevel: "Advanced",
    preferredTime: "Sat mornings",
    venue: "PlayTT Hurlingham",
    bio: "Competitive but friendly. Happy to help with serve practice.",
  },
  {
    id: "p3",
    name: "Priya M.",
    skillLevel: "Beginner",
    preferredTime: "Sun afternoons",
    venue: "PlayTT Hurlingham",
    bio: "New to table tennis. Looking for patient partners to learn with.",
  },
  {
    id: "p4",
    name: "Daniel W.",
    skillLevel: "Intermediate",
    preferredTime: "Fri after work",
    venue: "PlayTT Hurlingham",
    bio: "Usually books 90-minute sessions. Open to doubles too.",
  },
  {
    id: "p5",
    name: "Fatima A.",
    skillLevel: "Advanced",
    preferredTime: "Weekday lunch",
    venue: "PlayTT Hurlingham",
    bio: "Short sessions during lunch break. Fast-paced rallies preferred.",
  },
]

export const MOCK_OPEN_REQUESTS: CommunityPlayRequest[] = [
  {
    id: "r1",
    playerName: "Chris N.",
    skillLevel: "Intermediate",
    preferredTime: "Sat, 14 Jun · 4:00 PM",
    venue: "PlayTT Hurlingham",
    status: "open",
  },
  {
    id: "r2",
    playerName: "Lena T.",
    skillLevel: "Beginner",
    preferredTime: "Sun, 15 Jun · 11:00 AM",
    venue: "PlayTT Hurlingham",
    status: "open",
  },
  {
    id: "r3",
    playerName: "You",
    skillLevel: "Intermediate",
    preferredTime: "Wed, 18 Jun · 7:00 PM",
    venue: "PlayTT Hurlingham",
    status: "pending",
  },
]

export const COMMUNITY_SKILL_LEVELS = [
  "Beginner",
  "Intermediate",
  "Advanced",
] as const

export const COMMUNITY_TIME_SLOTS = [
  "Weekday mornings",
  "Weekday evenings",
  "Weekend mornings",
  "Weekend afternoons",
] as const
