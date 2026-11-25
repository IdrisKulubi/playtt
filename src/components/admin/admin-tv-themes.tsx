"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { XIcon } from "@phosphor-icons/react"

import {
  GroupedSection,
  LargeTitle,
  SectionFooter,
  SectionHeader,
  SegmentedControl,
  textActionClass,
} from "@/components/admin/admin-grouped"
import { ThemeBackground } from "@/components/display/themes/theme-background"
import { renderThemeStill } from "@/components/display/themes/theme-renderers"
import { TvIdleScene, TvSessionScene, TvUpNextScene } from "@/components/display/tv-scenes"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  PALETTE_PRESETS,
  RENDERER_DESCRIPTIONS,
  RENDERER_LABELS,
  THEME_RENDERERS,
  suggestedInk,
  type DisplayTheme,
  type ThemeInk,
  type ThemePalette,
  type ThemeRenderer,
} from "@/lib/display-themes"
import type { VenueThemeSummary } from "@/server/display/themes-service"

type PreviewState = "free" | "next" | "playing"

const PREVIEW_STATES: { value: PreviewState; label: string }[] = [
  { value: "free", label: "Table free" },
  { value: "next", label: "Up next" },
  { value: "playing", label: "Now playing" },
]

const COLOUR_FIELDS: { key: keyof ThemePalette; label: string; hint: string }[] = [
  { key: "base", label: "Background", hint: "The field behind everything" },
  { key: "accent", label: "Main colour", hint: "Ribbon, rings, main glow" },
  { key: "light", label: "Highlight", hint: "Light blooms and shine" },
  { key: "deep", label: "Shadow", hint: "Depth and folds" },
]

const primaryButtonClass =
  "h-10 rounded-full bg-primary px-5 text-[15px] font-semibold text-primary-foreground transition-transform duration-100 active:scale-[0.97] disabled:opacity-40"

const secondaryButtonClass =
  "h-10 rounded-full bg-muted px-5 text-[15px] font-medium text-foreground transition-transform duration-100 active:scale-[0.97] disabled:opacity-40"

function fileName(theme: DisplayTheme) {
  const slug = theme.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
  return `playtt-tv-${slug || "theme"}-4k.png`
}

async function downloadTheme(theme: DisplayTheme) {
  const blob = await renderThemeStill(theme)
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName(theme)
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** Shares the 4K image where the device supports it, otherwise copies a preview link. */
async function shareTheme(theme: DisplayTheme) {
  const link = `${window.location.origin}/admin/tv?preview=${encodeURIComponent(theme.key)}`
  try {
    const blob = await renderThemeStill(theme)
    const file = new File([blob], fileName(theme), { type: "image/png" })
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: `${theme.name} · PlayTT TV`, text: `${theme.name} TV theme` })
      return
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return
  }
  await navigator.clipboard.writeText(link)
  toast.success("Preview link copied.")
}

/** A 16:9 live miniature of the TV with sample text, so a theme is judged in context. */
function ThemeMiniature({ theme, label = "Now playing", name = "Wanjiru" }: { theme: DisplayTheme; label?: string; name?: string }) {
  const ink = theme.ink === "light" ? "#ffffff" : "#041019"
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl" style={{ backgroundColor: theme.palette.base }}>
      <ThemeBackground theme={theme} />
      <div className="absolute top-[8%] left-[5%]" style={{ color: ink }}>
        <p className="font-mono text-[9px] tracking-[0.24em] uppercase opacity-70">{label}</p>
        <p className="text-[clamp(20px,5.5cqw,40px)] leading-none font-bold tracking-[-0.045em]">{name}</p>
      </div>
    </div>
  )
}

function ThemeCard({
  theme,
  usedAt,
  canManage,
  onPreview,
  onEdit,
  onCustomize,
  onDelete,
}: {
  theme: DisplayTheme
  usedAt: string[]
  canManage: boolean
  onPreview: () => void
  onEdit: () => void
  onCustomize: () => void
  onDelete: () => void
}) {
  const [busy, setBusy] = useState<"download" | "share" | null>(null)

  async function run(kind: "download" | "share") {
    setBusy(kind)
    try {
      if (kind === "download") await downloadTheme(theme)
      else await shareTheme(theme)
    } catch {
      toast.error(kind === "download" ? "Couldn't make the image." : "Couldn't share the theme.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <li className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onPreview}
        className="@container block w-full rounded-xl text-left ring-1 ring-border/60 transition-transform duration-100 active:scale-[0.985]"
        aria-label={`Preview ${theme.name} full screen`}
      >
        <ThemeMiniature theme={theme} />
      </button>
      <div className="px-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate text-[15px] font-semibold">{theme.name}</p>
          <p className="shrink-0 text-[13px] text-muted-foreground">
            {theme.builtIn ? RENDERER_LABELS[theme.renderer] : `Custom · ${RENDERER_LABELS[theme.renderer]}`}
          </p>
        </div>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {usedAt.length > 0 ? `Main at ${usedAt.join(", ")}` : "Not on any TV yet"}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <button type="button" className={textActionClass} onClick={onPreview}>
            Preview
          </button>
          <button type="button" className={textActionClass} disabled={busy !== null} onClick={() => run("download")}>
            {busy === "download" ? "Making 4K…" : "Download"}
          </button>
          <button type="button" className={textActionClass} disabled={busy !== null} onClick={() => run("share")}>
            {busy === "share" ? "Preparing…" : "Share"}
          </button>
          {canManage ? (
            theme.builtIn ? (
              <button type="button" className={textActionClass} onClick={onCustomize}>
                Customize
              </button>
            ) : (
              <>
                <button type="button" className={textActionClass} onClick={onEdit}>
                  Edit
                </button>
                <button type="button" className="text-[13px] font-medium text-destructive transition-opacity active:opacity-50" onClick={onDelete}>
                  Delete
                </button>
              </>
            )
          ) : null}
        </div>
      </div>
    </li>
  )
}

/** Full-screen preview with the real TV screens and sample data. */
function ThemePreview({ theme, onClose }: { theme: DisplayTheme; onClose: () => void }) {
  const [state, setState] = useState<PreviewState>("playing")
  const [sample] = useState(() => {
    const now = Date.now()
    const start = Math.floor(now / 300_000) * 300_000
    return {
      playing: { bookingId: "preview-playing", firstName: "Wanjiru", groupSize: 4, startsAt: new Date(start - 20 * 60_000).toISOString(), endsAt: new Date(start + 40 * 60_000).toISOString() },
      next: { bookingId: "preview-next", firstName: "Wanjiru", groupSize: 4, startsAt: new Date(start + 5 * 60_000).toISOString(), endsAt: new Date(start + 65 * 60_000).toISOString() },
    }
  })

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const props = { tableName: "Table 1", venue: "PlayTT", theme }

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal aria-label={`${theme.name} preview`}>
      {state === "free" ? <TvIdleScene key="free" {...props} next={sample.next} /> : null}
      {state === "next" ? <TvUpNextScene key="next" {...props} booking={sample.next} /> : null}
      {state === "playing" ? <TvSessionScene key="playing" {...props} booking={sample.playing} /> : null}

      <div className="absolute bottom-[16vh] left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/45 p-1.5 pl-4 text-white shadow-xl backdrop-blur-xl">
        <span className="text-[13px] font-medium whitespace-nowrap">{theme.name}</span>
        <div className="[&_[role=tablist]]:bg-white/15 [&_button]:text-white/80 [&_button[aria-selected=true]]:bg-white [&_button[aria-selected=true]]:text-black">
          <SegmentedControl label="TV screen" value={state} onChange={setState} options={PREVIEW_STATES} />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-100 active:scale-[0.94]"
          aria-label="Close preview"
        >
          <XIcon className="size-4" weight="bold" />
        </button>
      </div>
    </div>
  )
}

type Draft = { id: string | null; name: string; renderer: ThemeRenderer; palette: ThemePalette; ink: ThemeInk }

function ThemeEditor({
  draft,
  onClose,
  onSaved,
}: {
  draft: Draft
  onClose: () => void
  onSaved: () => void
}) {
  const [value, setValue] = useState<Draft>(draft)
  const [saving, setSaving] = useState(false)
  const preview: DisplayTheme = { key: "draft", builtIn: false, ...value }
  const suggested = suggestedInk(value.palette.base)

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      const response = await fetch(value.id ? `/api/admin/display-themes/${value.id}` : "/api/admin/display-themes", {
        method: value.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: value.name, renderer: value.renderer, palette: value.palette, ink: value.ink }),
      })
      const payload = (await response.json().catch(() => ({}))) as { message?: string }
      if (!response.ok) {
        toast.error(payload.message ?? "Couldn't save the theme.")
        return
      }
      toast.success(value.id ? "Theme updated. TVs using it change within seconds." : `${value.name} is ready.`)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : null)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{value.id ? "Edit theme" : "New theme"}</DialogTitle>
          <DialogDescription>Pick a style and four colours. The preview is exactly what the TV shows.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-6 md:grid-cols-[1fr_1.15fr]">
          <div className="space-y-5">
            <label className="block">
              <span className="text-[13px] text-muted-foreground">Name</span>
              <input
                value={value.name}
                onChange={(event) => setValue({ ...value, name: event.target.value })}
                maxLength={48}
                required
                placeholder="Christmas"
                className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 text-[15px] outline-none focus:ring-2 focus:ring-ring"
              />
            </label>

            <div>
              <p className="text-[13px] text-muted-foreground">Style</p>
              <div className="mt-1">
                <SegmentedControl
                  label="Style"
                  value={value.renderer}
                  onChange={(renderer) => setValue({ ...value, renderer })}
                  options={THEME_RENDERERS.map((renderer) => ({ value: renderer, label: RENDERER_LABELS[renderer] }))}
                />
              </div>
              <p className="mt-1 text-[13px] text-muted-foreground">{RENDERER_DESCRIPTIONS[value.renderer]}</p>
            </div>

            <div>
              <p className="text-[13px] text-muted-foreground">Start from</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {PALETTE_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() =>
                      setValue({ ...value, palette: preset.palette, ink: suggestedInk(preset.palette.base) })
                    }
                    className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-[13px] font-medium transition-transform duration-100 active:scale-[0.96]"
                  >
                    <span className="flex -space-x-1" aria-hidden>
                      {[preset.palette.base, preset.palette.accent, preset.palette.deep].map((colour) => (
                        <span key={colour} className="size-3.5 rounded-full ring-2 ring-muted" style={{ backgroundColor: colour }} />
                      ))}
                    </span>
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <ul className="overflow-hidden rounded-2xl bg-card ring-1 ring-border/60 [&>li+li]:border-t [&>li+li]:border-border/60">
              {COLOUR_FIELDS.map((field) => (
                <li key={field.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <label htmlFor={`colour-${field.key}`} className="min-w-0">
                    <span className="block text-[15px]">{field.label}</span>
                    <span className="block text-[12px] text-muted-foreground">{field.hint}</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[13px] text-muted-foreground uppercase">{value.palette[field.key]}</span>
                    <input
                      id={`colour-${field.key}`}
                      type="color"
                      value={value.palette[field.key]}
                      onChange={(event) =>
                        setValue({ ...value, palette: { ...value.palette, [field.key]: event.target.value } })
                      }
                      className="size-9 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                    />
                  </div>
                </li>
              ))}
            </ul>

            <div>
              <p className="text-[13px] text-muted-foreground">Text on the TV</p>
              <div className="mt-1 flex items-center gap-3">
                <SegmentedControl
                  label="Text colour"
                  value={value.ink}
                  onChange={(ink) => setValue({ ...value, ink })}
                  options={[
                    { value: "light", label: "White" },
                    { value: "dark", label: "Navy" },
                  ]}
                />
                {value.ink !== suggested ? (
                  <button type="button" className={textActionClass} onClick={() => setValue({ ...value, ink: suggested })}>
                    Use {suggested === "light" ? "white" : "navy"} for this background
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="@container">
              <ThemeMiniature theme={preview} name={value.name.trim() || "Wanjiru"} />
            </div>
            <p className="text-[13px] text-muted-foreground">Live preview. Text sits where the name and timer go on the TV.</p>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className={secondaryButtonClass} onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className={primaryButtonClass} disabled={saving || !value.name.trim()}>
                {saving ? "Saving…" : value.id ? "Save changes" : "Create theme"}
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function AdminTvThemes({
  themes,
  venues,
  canManage,
  initialPreviewKey,
}: {
  themes: DisplayTheme[]
  venues: VenueThemeSummary[]
  canManage: boolean
  initialPreviewKey: string | null
}) {
  const router = useRouter()
  const [preview, setPreview] = useState<DisplayTheme | null>(
    () => themes.find((theme) => theme.key === initialPreviewKey) ?? null,
  )
  const [draft, setDraft] = useState<Draft | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DisplayTheme | null>(null)
  const [savingVenue, setSavingVenue] = useState<string | null>(null)
  const [venueKeys, setVenueKeys] = useState(() =>
    Object.fromEntries(venues.map((venue) => [venue.id, venue.themeKey])),
  )

  const closePreview = useCallback(() => setPreview(null), [])

  const usedAt = (key: string) =>
    venues.filter((venue) => venueKeys[venue.id] === key).map((venue) => venue.name)

  async function assign(venue: VenueThemeSummary, themeKey: string) {
    const previous = venueKeys[venue.id]
    setVenueKeys((current) => ({ ...current, [venue.id]: themeKey }))
    setSavingVenue(venue.id)
    try {
      const response = await fetch(`/api/admin/venues/${venue.id}/display-theme`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themeKey }),
      })
      const payload = (await response.json().catch(() => ({}))) as { message?: string }
      if (!response.ok) {
        setVenueKeys((current) => ({ ...current, [venue.id]: previous }))
        toast.error(payload.message ?? "Couldn't change the theme.")
        return
      }
      const name = themes.find((theme) => theme.key === themeKey)?.name ?? "The new theme"
      toast.success(`${name} is now on every TV at ${venue.name}.`)
    } finally {
      setSavingVenue(null)
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    const theme = pendingDelete
    setPendingDelete(null)
    const response = await fetch(`/api/admin/display-themes/${theme.key}`, { method: "DELETE" })
    const payload = (await response.json().catch(() => ({}))) as { message?: string }
    if (!response.ok) {
      toast.error(payload.message ?? "Couldn't delete the theme.")
      return
    }
    toast.success(`${theme.name} deleted.`)
    router.refresh()
  }

  const startNew = (base?: DisplayTheme) =>
    setDraft({
      id: null,
      name: base ? `${base.name} copy` : "",
      renderer: base?.renderer ?? "silk",
      palette: { ...(base?.palette ?? PALETTE_PRESETS[0].palette) },
      ink: base?.ink ?? "light",
    })

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <LargeTitle
        title="TV display"
        subtitle="The background every venue TV shows: free tables, up next and live games."
        accessory={
          canManage ? (
            <button type="button" className={primaryButtonClass} onClick={() => startNew()}>
              New theme
            </button>
          ) : null
        }
      />

      <GroupedSection
        header="Main theme per venue"
        footer={
          canManage
            ? "TVs switch on their next refresh, within a few seconds. No restart needed."
            : "Only catalog managers can change a venue's theme."
        }
      >
        {venues.length === 0 ? (
          <li className="px-4 py-3 text-[15px] text-muted-foreground">No active venues yet.</li>
        ) : (
          venues.map((venue) => (
            <li key={venue.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
              <label htmlFor={`venue-theme-${venue.id}`} className="min-w-0 truncate text-[15px]">
                {venue.name}
              </label>
              <select
                id={`venue-theme-${venue.id}`}
                value={venueKeys[venue.id]}
                disabled={!canManage || savingVenue === venue.id}
                onChange={(event) => assign(venue, event.target.value)}
                className="max-w-[55%] rounded-lg bg-muted/60 px-2.5 py-1.5 text-[15px] outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              >
                {themes.map((theme) => (
                  <option key={theme.key} value={theme.key}>
                    {theme.name}
                  </option>
                ))}
              </select>
            </li>
          ))
        )}
      </GroupedSection>

      <section>
        <SectionHeader accessory={`${themes.length} themes`}>Themes</SectionHeader>
        <ul className="mt-1 grid gap-x-6 gap-y-8 px-4 sm:grid-cols-2 lg:grid-cols-3">
          {themes.map((theme) => (
            <ThemeCard
              key={theme.key}
              theme={theme}
              usedAt={usedAt(theme.key)}
              canManage={canManage}
              onPreview={() => setPreview(theme)}
              onEdit={() => setDraft({ id: theme.key, name: theme.name, renderer: theme.renderer, palette: { ...theme.palette }, ink: theme.ink })}
              onCustomize={() => startNew(theme)}
              onDelete={() => setPendingDelete(theme)}
            />
          ))}
        </ul>
        <SectionFooter>
          Each theme covers every TV screen. Download gives a 4K image of the background; Share sends it from this
          device or copies a preview link. Customize a built-in theme to make seasonal versions, like Christmas Silk.
        </SectionFooter>
      </section>

      {preview ? <ThemePreview theme={preview} onClose={closePreview} /> : null}

      {draft ? (
        <ThemeEditor
          draft={draft}
          onClose={() => setDraft(null)}
          onSaved={() => {
            setDraft(null)
            router.refresh()
          }}
        />
      ) : null}

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => (!open ? setPendingDelete(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && usedAt(pendingDelete.key).length > 0
                ? `TVs at ${usedAt(pendingDelete.key).join(", ")} will go back to Liquid Glass.`
                : "No TV uses this theme. This can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
