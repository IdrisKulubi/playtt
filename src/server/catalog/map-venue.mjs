export function mapLocationToVenue(location) {
  return {
    venueId: location.id,
    tenantId: location.tenantId ?? null,
    brandId: location.brandId ?? null,
    name: location.name,
    slug: location.slug,
    address: location.address,
    timezone: location.timezone,
    isActive: location.isActive,
    settings: location.settings ?? null,
    archivedAt: location.archivedAt ?? null,
    notes: location.notes ?? null,
  }
}
