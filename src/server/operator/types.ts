import type {
  resourceTypeEnum,
  tenantMembershipRoleEnum,
  tenantMembershipStatusEnum,
  tenantStatusEnum,
} from "@/db/schema"

export type OperatorTenantStatus =
  (typeof tenantStatusEnum.enumValues)[number]

export type OperatorMembershipRole =
  (typeof tenantMembershipRoleEnum.enumValues)[number]

export type OperatorMembershipStatus =
  (typeof tenantMembershipStatusEnum.enumValues)[number]

export type OperatorResourceKind =
  (typeof resourceTypeEnum.enumValues)[number]

export interface OperatorTenantSummary {
  id: string
  name: string
  slug: string
  status: OperatorTenantStatus
  settings: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface OperatorVenue {
  id: string
  tenantId: string
  brandId: string | null
  name: string
  slug: string
  address: string
  timezone: string
  isActive: boolean
  settings: Record<string, unknown> | null
  archivedAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface OperatorZone {
  id: string
  tenantId: string
  locationId: string
  name: string
  slug: string
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface OperatorResource {
  id: string
  tenantId: string
  locationId: string
  zoneId: string | null
  resourceTypeId: string | null
  name: string
  slug: string
  code: string | null
  type: OperatorResourceKind
  ruleset: string | null
  capacity: number
  sortOrder: number
  isActive: boolean
  metadata: Record<string, unknown> | null
  configuration: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface OperatorResourceType {
  id: string
  tenantId: string
  code: string
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface OperatorCapability {
  id: string
  tenantId: string
  resourceId: string
  code: string
  config: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface OperatorMembership {
  id: string
  tenantId: string
  userId: string
  role: OperatorMembershipRole
  status: OperatorMembershipStatus
  email: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface OperatorFeatureFlag {
  id: string
  tenantId: string
  key: string
  enabled: boolean
  scope: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface OperatorCatalogOverviewVenue {
  venue: OperatorVenue
  zoneCount: number
  resourceCount: number
  capabilityCount: number
}

export interface OperatorCatalogOverview {
  tenant: OperatorTenantSummary
  resourceTypeCount: number
  membershipCount: number
  venues: OperatorCatalogOverviewVenue[]
}
