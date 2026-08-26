export interface FeatureFlagScope {
  locationIds?: string[]
  resourceIds?: string[]
}

export interface FeatureFlagScopeTarget {
  locationId?: string
  resourceId?: string
}

function normalizeIdList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  const ids = value.filter(
    (entry): entry is string => typeof entry === "string" && entry.length > 0,
  )

  return ids.length > 0 ? ids : undefined
}

export function parseFeatureFlagScope(
  scope: Record<string, unknown> | null | undefined,
): FeatureFlagScope | null {
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) {
    return null
  }

  const locationIds = normalizeIdList(scope.locationIds)
  const resourceIds = normalizeIdList(scope.resourceIds)

  if (!locationIds && !resourceIds) {
    return null
  }

  return {
    locationIds,
    resourceIds,
  }
}

export function isFeatureFlagEnabledForScope(
  enabled: boolean,
  scope: FeatureFlagScope | null | undefined,
  target: FeatureFlagScopeTarget,
): boolean {
  if (!enabled) {
    return false
  }

  if (scope?.locationIds?.length) {
    if (!target.locationId || !scope.locationIds.includes(target.locationId)) {
      return false
    }
  }

  if (scope?.resourceIds?.length) {
    if (!target.resourceId || !scope.resourceIds.includes(target.resourceId)) {
      return false
    }
  }

  return true
}
