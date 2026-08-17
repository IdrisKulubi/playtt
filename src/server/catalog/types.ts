export interface Venue {
  venueId: string
  tenantId: string | null
  brandId: string | null
  name: string
  slug: string
  address: string
  timezone: string
  isActive: boolean
  settings: Record<string, unknown> | null
  archivedAt: Date | null
  notes: string | null
}

export interface LocationRow {
  id: string
  tenantId: string | null
  brandId: string | null
  name: string
  slug: string
  address: string
  timezone: string
  isActive: boolean
  settings: Record<string, unknown> | null
  archivedAt: Date | null
  notes: string | null
}
