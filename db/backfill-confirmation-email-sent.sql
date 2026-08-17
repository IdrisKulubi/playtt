-- Mark historical booking confirmation emails as already sent.
-- Inline confirmation sent these before P2-06 moved delivery behind the worker.
update notifications
set
  status = 'sent',
  sent_at = coalesce(sent_at, now())
where channel = 'email'
  and template_key = 'booking_confirmed'
  and status = 'pending';
