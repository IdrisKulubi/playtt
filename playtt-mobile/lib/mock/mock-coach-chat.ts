import { MOCK_COACH_INSIGHTS, MOCK_COACH_TRAINING } from "@/lib/mock/mock-coach"

export type CoachChatRole = "coach" | "player"

export type CoachChatMessage = {
  id: string
  role: CoachChatRole
  text: string
  createdAt: string
}

export type CoachQuickPrompt = {
  id: string
  label: string
  message: string
}

const latestReplayTitle = MOCK_COACH_INSIGHTS[0]?.replayTitle ?? "your last session"

export const INITIAL_COACH_MESSAGES: CoachChatMessage[] = [
  {
    id: "coach-welcome",
    role: "coach",
    text: `Hi. I reviewed your clip from "${latestReplayTitle}". What do you want to work on today?`,
    createdAt: new Date().toISOString(),
  },
]

export const QUICK_PROMPTS: CoachQuickPrompt[] = [
  {
    id: "serve",
    label: "Improve my serve",
    message: "How can I improve my serve?",
  },
  {
    id: "footwork",
    label: "Footwork drill",
    message: "Give me a footwork drill for my next session.",
  },
  {
    id: "clip",
    label: "Review my last clip",
    message: "What stood out in my last clip?",
  },
  {
    id: "warmup",
    label: "Pre-session warmup",
    message: "What should I do to warm up before I play?",
  },
]

function createCoachMessage(text: string): CoachChatMessage {
  return {
    id: `coach-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role: "coach",
    text,
    createdAt: new Date().toISOString(),
  }
}

function matchesAny(text: string, keywords: string[]) {
  const normalized = text.toLowerCase()
  return keywords.some((keyword) => normalized.includes(keyword))
}

export function resolveMockCoachReply(
  userText: string,
  _history: CoachChatMessage[],
): CoachChatMessage {
  const insight = MOCK_COACH_INSIGHTS[0]
  const drill = MOCK_COACH_TRAINING[0]

  if (matchesAny(userText, ["serve", "second serve", "spin"])) {
    return createCoachMessage(
      "Your second serve is a good place to gain free points. Practice alternating backspin and no-spin serves to the elbow, then aim wide on the third ball. Keep the toss consistent and contact the ball lower for more spin.",
    )
  }

  if (matchesAny(userText, ["footwork", "recovery", "split-step", "movement"])) {
    return createCoachMessage(
      drill
        ? `${drill.title}: ${drill.description} Start slow, then build pace once your reset feels automatic.`
        : "After each forehand, reset with a small split-step before the next ball. Five minutes of slow feeds will make your recovery much cleaner.",
    )
  }

  if (
    matchesAny(userText, [
      "clip",
      "replay",
      "smash",
      "last session",
      "video",
      "highlight",
    ])
  ) {
    return createCoachMessage(
      insight
        ? `From "${insight.replayTitle}": ${insight.summary} Focus next on ${insight.focusAreas.join(" and ").toLowerCase()}.`
        : "Your last clip showed strong attack when you stepped in early. The main fix is balance on recovery before the next swing.",
    )
  }

  if (matchesAny(userText, ["warm", "warmup", "before", "prepare"])) {
    return createCoachMessage(
      "Before you play: 3 minutes of shadow footwork, 2 minutes of serve practice, then 5 minutes of controlled rally at 70% pace. Save full-speed smashes until your timing feels sharp.",
    )
  }

  if (matchesAny(userText, ["forehand", "attack", "topspin"])) {
    return createCoachMessage(
      "On forehand attack, step in with your front foot and finish high. If you rush the next ball, pause for one split-step before swinging again. Ten cross-court forehands at medium pace is a good reset drill.",
    )
  }

  if (matchesAny(userText, ["backhand", "block", "flick"])) {
    return createCoachMessage(
      "Keep your backhand compact and contact the ball early. Against faster players, stay close to the table and block with a short follow-through. Add a backhand flick only when the receive is short and predictable.",
    )
  }

  if (matchesAny(userText, ["nervous", "anxiety", "pressure", "tight", "stress"])) {
    return createCoachMessage(
      "Pre-match nerves are normal. Pick one simple goal for the session, like \"first three balls to the middle.\" Breathe out on serve and use your first rally to find rhythm, not winners.",
    )
  }

  if (matchesAny(userText, ["book", "session", "schedule", "reserve"])) {
    return createCoachMessage(
      "Book a 60-minute session when you can practice one theme only, like serve or footwork. After you play, capture a clip so we can review what actually happened in the match.",
    )
  }

  if (matchesAny(userText, ["beginner", "new", "start", "learning"])) {
    return createCoachMessage(
      "Start with consistent rallying and basic serve receive. Keep your grip relaxed, watch the ball through contact, and aim for three-shot rallies before you chase power. Short, focused sessions beat long unfocused ones.",
    )
  }

  if (matchesAny(userText, ["drill", "practice", "training", "work on"])) {
    return createCoachMessage(
      "Pick one drill for this week: either second-serve variation or split-step recovery. Do it for 8 minutes at the start of each session, then play normally. Consistency matters more than volume.",
    )
  }

  return createCoachMessage(
    "Tell me more about what felt off in your last session. Was it serve, footwork, forehand, or something else?",
  )
}

export function createPlayerMessage(text: string): CoachChatMessage {
  return {
    id: `player-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role: "player",
    text: text.trim(),
    createdAt: new Date().toISOString(),
  }
}
