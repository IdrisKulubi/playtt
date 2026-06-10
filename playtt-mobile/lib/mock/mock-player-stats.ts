export type PlayerStats = {
  sessionsPlayed: number
  totalSpendKes: number
  hoursPlayed: number
  peakSessions: number
  offPeakSessions: number
  monthlySessions: { month: string; count: number }[]
}

export const MOCK_PLAYER_STATS: PlayerStats = {
  sessionsPlayed: 12,
  totalSpendKes: 28500,
  hoursPlayed: 14,
  peakSessions: 7,
  offPeakSessions: 5,
  monthlySessions: [
    { month: "Jan", count: 2 },
    { month: "Feb", count: 3 },
    { month: "Mar", count: 4 },
    { month: "Apr", count: 3 },
  ],
}
