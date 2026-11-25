import { and, asc, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import { displayThemes, locations } from "@/db/schema"
import {
  BUILT_IN_THEMES,
  DEFAULT_THEME_KEY,
  builtInTheme,
  defaultTheme,
  isThemeRenderer,
  normalisePalette,
  type DisplayTheme,
  type ThemeInk,
  type ThemePalette,
  type ThemeRenderer,
} from "@/lib/display-themes"
import { authorize } from "@/server/tenancy/authorize-context.mjs"
import { writeAuditLog } from "@/server/tenancy/audit-log.mjs"
import type { TenantContext } from "@/server/tenancy/types"

export class DisplayThemeError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message)
  }
}

type ThemeRow = typeof displayThemes.$inferSelect

function fromRow(row: ThemeRow): DisplayTheme | null {
  if (!isThemeRenderer(row.renderer)) return null
  return {
    key: row.id,
    name: row.name,
    renderer: row.renderer,
    palette: normalisePalette(row.renderer, row.palette),
    ink: row.ink === "light" ? "light" : "dark",
    builtIn: false,
  }
}

async function customThemes(tenantId: string): Promise<DisplayTheme[]> {
  const rows = await db
    .select()
    .from(displayThemes)
    .where(eq(displayThemes.tenantId, tenantId))
    .orderBy(asc(displayThemes.createdAt))
  return rows.map(fromRow).filter((theme): theme is DisplayTheme => Boolean(theme))
}

async function findTheme(tenantId: string, key: string): Promise<DisplayTheme | null> {
  const builtIn = builtInTheme(key)
  if (builtIn) return builtIn
  if (!/^[0-9a-f-]{36}$/i.test(key)) return null
  const [row] = await db
    .select()
    .from(displayThemes)
    .where(and(eq(displayThemes.tenantId, tenantId), eq(displayThemes.id, key)))
    .limit(1)
  return row ? fromRow(row) : null
}

/**
 * The theme a venue TV should show. Public (the TV is not signed in), so it
 * never throws: any problem, including an unapplied migration, falls back to
 * the default theme and the screen keeps working.
 */
export async function resolveDisplayThemeForLocation(input: {
  tenantId: string
  locationId: string
}): Promise<DisplayTheme> {
  try {
    const [location] = await db
      .select({ key: locations.displayThemeKey })
      .from(locations)
      .where(and(eq(locations.tenantId, input.tenantId), eq(locations.id, input.locationId)))
      .limit(1)
    const key = location?.key ?? DEFAULT_THEME_KEY
    return (await findTheme(input.tenantId, key)) ?? defaultTheme()
  } catch {
    return defaultTheme()
  }
}

export interface VenueThemeSummary {
  id: string
  name: string
  themeKey: string
}

export async function getDisplayThemesOverview(context: TenantContext): Promise<{
  themes: DisplayTheme[]
  venues: VenueThemeSummary[]
}> {
  authorize(context, "catalog.read")
  const [custom, venues] = await Promise.all([
    customThemes(context.tenantId),
    db
      .select({ id: locations.id, name: locations.name, key: locations.displayThemeKey })
      .from(locations)
      .where(and(eq(locations.tenantId, context.tenantId), eq(locations.isActive, true)))
      .orderBy(asc(locations.name)),
  ])
  return {
    themes: [...BUILT_IN_THEMES, ...custom],
    venues: venues.map((venue) => ({
      id: venue.id,
      name: venue.name,
      themeKey: venue.key ?? DEFAULT_THEME_KEY,
    })),
  }
}

export interface ThemeInput {
  name: string
  renderer: ThemeRenderer
  palette: ThemePalette
  ink: ThemeInk
}

function cleanInput(input: ThemeInput): ThemeInput {
  const name = input.name.trim().slice(0, 48)
  if (!name) throw new DisplayThemeError("VALIDATION_ERROR", "Give the theme a name.")
  if (!isThemeRenderer(input.renderer)) {
    throw new DisplayThemeError("VALIDATION_ERROR", "Pick a style for the theme.")
  }
  return {
    name,
    renderer: input.renderer,
    palette: normalisePalette(input.renderer, input.palette),
    ink: input.ink === "light" ? "light" : "dark",
  }
}

export async function createDisplayTheme(
  context: TenantContext & { userId?: string },
  input: ThemeInput,
): Promise<DisplayTheme> {
  authorize(context, "catalog.manage")
  const clean = cleanInput(input)
  const [row] = await db
    .insert(displayThemes)
    .values({
      tenantId: context.tenantId,
      name: clean.name,
      renderer: clean.renderer,
      palette: { ...clean.palette },
      ink: clean.ink,
      createdBy: context.userId ?? null,
    })
    .returning()
  await writeAuditLog(context, {
    action: "display.theme.create",
    targetType: "display_theme",
    targetId: row.id,
    metadata: { name: clean.name, renderer: clean.renderer },
  })
  return fromRow(row)!
}

export async function updateDisplayTheme(
  context: TenantContext,
  themeId: string,
  input: ThemeInput,
): Promise<DisplayTheme> {
  authorize(context, "catalog.manage")
  const clean = cleanInput(input)
  const [row] = await db
    .update(displayThemes)
    .set({
      name: clean.name,
      renderer: clean.renderer,
      palette: { ...clean.palette },
      ink: clean.ink,
    })
    .where(and(eq(displayThemes.tenantId, context.tenantId), eq(displayThemes.id, themeId)))
    .returning()
  if (!row) throw new DisplayThemeError("NOT_FOUND", "That theme no longer exists.", 404)
  await writeAuditLog(context, {
    action: "display.theme.update",
    targetType: "display_theme",
    targetId: themeId,
    metadata: { name: clean.name, renderer: clean.renderer },
  })
  return fromRow(row)!
}

/** Deletes a custom theme; venues using it go back to the default. */
export async function deleteDisplayTheme(context: TenantContext, themeId: string) {
  authorize(context, "catalog.manage")
  await db.transaction(async (tx) => {
    await tx
      .update(locations)
      .set({ displayThemeKey: null })
      .where(and(eq(locations.tenantId, context.tenantId), eq(locations.displayThemeKey, themeId)))
    const deleted = await tx
      .delete(displayThemes)
      .where(and(eq(displayThemes.tenantId, context.tenantId), eq(displayThemes.id, themeId)))
      .returning({ id: displayThemes.id })
    if (deleted.length === 0) {
      throw new DisplayThemeError("NOT_FOUND", "That theme no longer exists.", 404)
    }
  })
  await writeAuditLog(context, {
    action: "display.theme.delete",
    targetType: "display_theme",
    targetId: themeId,
    metadata: {},
  })
}

/** Makes a theme the main one on every TV at a venue. */
export async function setVenueDisplayTheme(
  context: TenantContext,
  input: { locationId: string; themeKey: string },
) {
  authorize(context, "catalog.manage")
  const theme = await findTheme(context.tenantId, input.themeKey)
  if (!theme) throw new DisplayThemeError("NOT_FOUND", "That theme no longer exists.", 404)
  const updated = await db
    .update(locations)
    .set({ displayThemeKey: theme.key })
    .where(and(eq(locations.tenantId, context.tenantId), eq(locations.id, input.locationId)))
    .returning({ id: locations.id })
  if (updated.length === 0) throw new DisplayThemeError("NOT_FOUND", "That venue no longer exists.", 404)
  await writeAuditLog(context, {
    action: "display.theme.assign",
    targetType: "location",
    targetId: input.locationId,
    metadata: { themeKey: theme.key, themeName: theme.name },
  })
  return theme
}
