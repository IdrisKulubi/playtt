import type { tenantMembershipRoleEnum } from "@/db/schema"

export type TenantMembershipRole =
  (typeof tenantMembershipRoleEnum.enumValues)[number]

export type TenantAction =
  | "booking.read"
  | "booking.create"
  | "booking.modify"
  | "booking.cancel"
  | "account.read"
  | "account.update"
  | "venue.read"
  | "venue.manage"
  | "membership.read"
  | "membership.manage"
  | "catalog.read"
  | "catalog.manage"
  | "analytics.read"

export type TenantActorType = "user" | "device" | "service"

export interface TenantActor {
  type: TenantActorType
  id: string
}

export interface TenantContext {
  tenantId: string
  actor: TenantActor
  membershipId?: string
  role?: TenantMembershipRole
  venueIds?: string[]
  correlationId: string
}
