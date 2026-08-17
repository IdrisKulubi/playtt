-- Backfill operational play sessions for eligible bookings.
-- Safe to rerun: inserts only when no play_sessions row exists for the booking.

insert into play_sessions (
  tenant_id,
  booking_id,
  location_id,
  resource_id,
  status,
  correlation_id,
  scheduled_start_at,
  scheduled_end_at,
  configuration_snapshot,
  configuration_version
)
select
  b.tenant_id,
  b.id,
  b.location_id,
  b.resource_id,
  case
    when b.status = 'completed' then 'completed'::play_session_status
    else 'confirmed'::play_session_status
  end,
  'backfill-play-sessions',
  b.start_time,
  b.end_time,
  jsonb_build_object(
    'resource',
    jsonb_build_object(
      'ruleset', r.ruleset,
      'configuration', r.configuration,
      'metadata', r.metadata,
      'name', r.name,
      'code', r.code
    ),
    'booking',
    jsonb_build_object(
      'pricingRuleSnapshot', b.pricing_rule_snapshot,
      'totalAmount', b.total_amount,
      'currency', b.currency
    )
  ),
  1
from bookings b
inner join resources r
  on r.tenant_id = b.tenant_id
 and r.id = b.resource_id
where b.status in ('confirmed', 'completed')
  and b.payment_status = 'paid'
  and not exists (
    select 1
    from play_sessions ps
    where ps.booking_id = b.id
  );

insert into session_participants (
  tenant_id,
  play_session_id,
  user_id,
  role
)
select
  ps.tenant_id,
  ps.id,
  b.user_id,
  'owner'::session_participant_role
from play_sessions ps
inner join bookings b
  on b.id = ps.booking_id
where not exists (
  select 1
  from session_participants sp
  where sp.play_session_id = ps.id
    and sp.user_id = b.user_id
);

update matches m
set play_session_id = ps.id
from play_sessions ps
where m.booking_id = ps.booking_id
  and m.play_session_id is null;

update access_credentials ac
set play_session_id = ps.id
from play_sessions ps
where ac.booking_id = ps.booking_id
  and ac.play_session_id is null;

update session_events se
set play_session_id = ps.id
from play_sessions ps
where se.booking_id = ps.booking_id
  and se.play_session_id is null;

update replays r
set play_session_id = ps.id
from play_sessions ps
where r.booking_id = ps.booking_id
  and r.play_session_id is null;
