export type MockReplay = {
  id: string
  title: string
  recordedAt: string
  durationSeconds: number
  locationName: string
  coachReviewed?: boolean
}

export const MOCK_REPLAYS: MockReplay[] = [
  {
    id: "replay-1",
    title: "Smash rally",
    recordedAt: "2026-05-28T18:30:00.000Z",
    durationSeconds: 28,
    locationName: "PlayTT Hurlingham",
    coachReviewed: true,
  },
  {
    id: "replay-2",
    title: "Match point",
    recordedAt: "2026-05-21T19:00:00.000Z",
    durationSeconds: 30,
    locationName: "PlayTT Hurlingham",
    coachReviewed: true,
  },
  {
    id: "replay-3",
    title: "Warm-up rally",
    recordedAt: "2026-05-14T17:45:00.000Z",
    durationSeconds: 24,
    locationName: "PlayTT Hurlingham",
  },
]
