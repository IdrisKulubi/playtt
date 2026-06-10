export type PaystackChargeStatus =
  | "pending"
  | "pay_offline"
  | "success"
  | "failed"
  | "timeout"
  | "send_otp"
  | "send_birthday"

export type PaystackChargeData = {
  reference: string
  status: PaystackChargeStatus
  display_text?: string
  message?: string
}

export type PaystackApiResponse<T> = {
  status: boolean
  message: string
  data: T
}

export type PaystackTransactionData = {
  id: number
  status: string
  reference: string
  amount: number
  currency: string
  paid_at?: string | null
  gateway_response?: string | null
  metadata?: Record<string, unknown> | string | null
}

export type PaystackWebhookEvent = {
  event: string
  data: PaystackTransactionData
}

export type InitiatePaymentResult = {
  reference: string
  status: PaystackChargeStatus
  displayText: string
  expiresAt: string | null
  bookingId: string
}

export type PaymentStatusResult = {
  bookingId: string
  bookingStatus: string
  paymentStatus: string
  reference: string | null
  providerStatus: string | null
  displayText: string | null
  expiresAt: string | null
}

export type BookingPaymentContext = {
  id: string
  userId: string
  locationId: string
  status: string
  paymentStatus: string
  totalAmount: string
  currency: string
  expiresAt: Date | null
  userEmail: string
  userPhone: string | null
  userName: string
  locationName: string
  resourceName: string
  startTime: Date
  endTime: Date
}
