export const TENANT_ACTIONS = [
  "booking.read",
  "booking.create",
  "booking.modify",
  "booking.cancel",
  "account.read",
  "account.update",
  "venue.read",
  "venue.manage",
  "membership.read",
  "membership.manage",
  "catalog.read",
  "catalog.manage",
]

const CUSTOMER_ACTIONS = [
  "booking.read",
  "booking.create",
  "booking.modify",
  "booking.cancel",
  "account.read",
  "account.update",
  "venue.read",
]

const SUPPORT_ACTIONS = [
  "booking.read",
  "account.read",
  "venue.read",
  "membership.read",
  "catalog.read",
]

const OPERATOR_ACTIONS = [
  ...CUSTOMER_ACTIONS,
  "membership.read",
  "catalog.read",
  "catalog.manage",
  "venue.manage",
]

const OWNER_ACTIONS = [...OPERATOR_ACTIONS, "membership.manage"]

const ROLE_ACTIONS = {
  customer: CUSTOMER_ACTIONS,
  support: SUPPORT_ACTIONS,
  operator: OPERATOR_ACTIONS,
  owner: OWNER_ACTIONS,
}

export function isTenantAction(value) {
  return TENANT_ACTIONS.includes(value)
}

export function canPerformTenantAction(role, action) {
  return ROLE_ACTIONS[role]?.includes(action) ?? false
}
