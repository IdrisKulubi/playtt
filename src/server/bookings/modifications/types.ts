export type ModificationSnapshot = {
  startTime: string
  endTime: string
  durationMinutes: number
  groupSize: number
  resourceId: string
  subtotalAmount: string
  discountAmount: string
  totalAmount: string
  notes: string | null
  pricingRuleSnapshot: Record<string, unknown>
}

export type ModificationQuoteResult = {
  currentTotal: string
  newTotal: string
  deltaAmount: string
  creditAmount: string
  requiresPayment: boolean
  changeType: string
  newGroupSize: number
  newStartTime: string
  newEndTime: string
  newResourceId: string
  newResourceName: string
  currency: string
}

export type ModificationApplyResult = {
  modificationId: string
  status: "applied" | "pending_payment"
  deltaAmount: string
  creditAmount: string
  requiresPayment: boolean
  authorizationUrl?: string
  returnUrl?: string
  displayText?: string
}

export type ModificationStatusResult = {
  modificationId: string
  status: string
  applied: boolean
}
