export const CLAIM_INBOX_SQL = `
SELECT *
FROM payment_webhook_inbox
WHERE available_at <= now()
  AND (lease_expires_at IS NULL OR lease_expires_at <= now())
  AND (
    status IN ('received', 'failed')
    OR status = 'processing'
  )
ORDER BY received_at ASC
LIMIT $1
FOR UPDATE SKIP LOCKED
`

export function buildClaimOutboxSql(hasEventTypes) {
  if (!hasEventTypes) {
    return null
  }

  return `
SELECT *
FROM outbox_events
WHERE available_at <= now()
  AND (lease_expires_at IS NULL OR lease_expires_at <= now())
  AND (
    status = 'pending'
    OR status = 'processing'
  )
  AND event_type = ANY($2::text[])
ORDER BY created_at ASC
LIMIT $1
FOR UPDATE SKIP LOCKED
`
}
