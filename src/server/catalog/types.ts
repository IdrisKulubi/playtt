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

export interface PublicVenue {
  venueId: string
  name: string
  slug: string
  address: string
  timezone: string
  isActive: boolean
  tenantId?: string | null
  brandId?: string | null
  settings?: Record<string, unknown> | null
}

export interface PublicResource {
  resourceId: string
  venueId: string
  name: string
  slug: string
  type: string
  capacity: number
  code?: string | null
  zoneId?: string | null
  resourceTypeId?: string | null
  ruleset?: string | null
  capabilities?: string[]
}

export interface PublicVenueDetail extends PublicVenue {
  resources: PublicResource[]
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
