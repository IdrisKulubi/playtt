// Web version of the PlayTT player card (docs/community/player-card.md),
// used on the invite landing page and the web Community page.

type Tier = "rookie" | "club" | "elite"

type WebPlayerCardProps = {
  displayName: string
  skillLevel: string
  stats: {
    rating: number | null
    matches: number | null
    winRate: number | null
    reliability: number | null
  } | null
  badges?: string[]
  footer?: string
}

const TIER_STYLES: Record<Tier, { name: string; background: string; accent: string; border: string }> = {
  rookie: {
    name: "Rookie",
    background: "linear-gradient(170deg, #1a2230 0%, #0e141d 100%)",
    accent: "#5fd4ff",
    border: "rgba(95, 212, 255, 0.4)",
  },
  club: {
    name: "Club",
    background: "linear-gradient(170deg, #0a3d6b 0%, #06182b 100%)",
    accent: "#00b7ff",
    border: "#00b7ff",
  },
  elite: {
    name: "Elite",
    background: "linear-gradient(170deg, #22232b 0%, #0b0b10 100%)",
    accent: "#f5c84c",
    border: "#f5c84c",
  },
}

const BADGE_LABELS: Record<string, string> = {
  in_form: "In form",
  rally_ace: "Rally ace",
  fair_play: "Fair play",
  clockwork: "Clockwork",
  good_vibes: "Good vibes",
  ace_server: "Ace server",
  mentor: "Mentor",
  reliable: "Reliable",
}

function tierFor(skillLevel: string, rating: number | null): Tier {
  if (rating !== null) return rating >= 80 ? "elite" : rating >= 60 ? "club" : "rookie"
  if (skillLevel === "pro") return "elite"
  if (skillLevel === "intermediate") return "club"
  return "rookie"
}

function initials(name: string) {
  return (
    name
      .replace(/\./g, "")
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase())
      .join("")
      .slice(0, 2) || "P"
  )
}

const dash = (value: number | null | undefined) => (value === null || value === undefined ? "—" : String(value))

export function WebPlayerCard({ displayName, skillLevel, stats, badges = [], footer }: WebPlayerCardProps) {
  const tier = TIER_STYLES[tierFor(skillLevel, stats?.rating ?? null)]
  const slots = [
    { code: "MAT", value: stats?.matches },
    { code: "WIN%", value: stats?.winRate },
    { code: "REL", value: stats?.reliability },
  ]

  return (
    <div
      role="img"
      aria-label={`${displayName}, ${tier.name} tier player card`}
      className="relative mx-auto aspect-[3/4] w-full max-w-[280px] overflow-hidden rounded-[24px] p-5 text-white shadow-2xl"
      style={{ background: tier.background, border: `2px solid ${tier.border}` }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "repeating-linear-gradient(135deg, #fff 0 1px, transparent 1px 14px)",
        }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-[38%] h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
        style={{ background: tier.accent, opacity: 0.25 }}
      />

      <div className="relative flex h-full flex-col">
        <div>
          <p className="text-4xl font-bold leading-none">{stats?.rating ?? "NEW"}</p>
          <p className="mt-1 text-xs font-bold tracking-[0.2em]" style={{ color: tier.accent }}>
            {tier.name.toUpperCase()}
          </p>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div
            className="flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold"
            style={{ border: `3px solid ${tier.accent}`, background: "rgba(255,255,255,0.06)" }}
          >
            {initials(displayName)}
          </div>
        </div>

        <p
          className="rounded-lg py-1.5 text-center text-lg font-bold tracking-[0.12em]"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          {displayName.toUpperCase()}
        </p>

        <div className="mt-3 grid grid-cols-3 text-center">
          {slots.map((slot) => (
            <div key={slot.code}>
              <p className={slot.value === null || slot.value === undefined ? "text-lg font-bold text-white/50" : "text-lg font-bold"}>
                {dash(slot.value)}
              </p>
              <p className="text-[10px] font-semibold tracking-wider text-white/60">{slot.code}</p>
            </div>
          ))}
        </div>

        {badges.length > 0 ? (
          <p className="mt-2 text-center text-[11px] text-white/70">
            {badges
              .map((badge) => BADGE_LABELS[badge])
              .filter(Boolean)
              .slice(0, 3)
              .join(" · ")}
          </p>
        ) : null}

        {footer ? <p className="mt-2 text-center text-[11px] text-white/60">{footer}</p> : null}
      </div>
    </div>
  )
}
