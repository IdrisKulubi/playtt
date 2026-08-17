-- Tenant scope backfill for PlayTT MVP
-- Safe to rerun: only updates rows where tenant_id IS NULL.

-- PlayTT tenant constant (deterministic seed ID)
-- 33333333-3333-3333-3333-333333333333

update locations
set tenant_id = '33333333-3333-3333-3333-333333333333'
where tenant_id is null;

update resources r
set tenant_id = l.tenant_id
from locations l
where r.location_id = l.id
  and r.tenant_id is null
  and l.tenant_id is not null;

update bookings b
set tenant_id = l.tenant_id
from locations l
where b.location_id = l.id
  and b.tenant_id is null
  and l.tenant_id is not null;

update payments p
set tenant_id = b.tenant_id
from bookings b
where p.booking_id = b.id
  and p.tenant_id is null
  and b.tenant_id is not null;

update booking_modifications bm
set tenant_id = b.tenant_id
from bookings b
where bm.booking_id = b.id
  and bm.tenant_id is null
  and b.tenant_id is not null;

update booking_status_history bsh
set tenant_id = b.tenant_id
from bookings b
where bsh.booking_id = b.id
  and bsh.tenant_id is null
  and b.tenant_id is not null;

update access_credentials ac
set tenant_id = b.tenant_id
from bookings b
where ac.booking_id = b.id
  and ac.tenant_id is null
  and b.tenant_id is not null;

update session_events se
set tenant_id = b.tenant_id
from bookings b
where se.booking_id = b.id
  and se.tenant_id is null
  and b.tenant_id is not null;

update matches m
set tenant_id = b.tenant_id
from bookings b
where m.booking_id = b.id
  and m.tenant_id is null
  and b.tenant_id is not null;

update replays r
set tenant_id = b.tenant_id
from bookings b
where r.booking_id = b.id
  and r.tenant_id is null
  and b.tenant_id is not null;

update notifications n
set tenant_id = b.tenant_id
from bookings b
where n.booking_id = b.id
  and n.tenant_id is null
  and b.tenant_id is not null;

update notifications n
set tenant_id = l.tenant_id
from locations l
where n.location_id = l.id
  and n.tenant_id is null
  and l.tenant_id is not null;

update notifications
set tenant_id = '33333333-3333-3333-3333-333333333333'
where tenant_id is null;

update hardware_configs hc
set tenant_id = l.tenant_id
from locations l
where hc.location_id = l.id
  and hc.tenant_id is null
  and l.tenant_id is not null;

update coach_insights ci
set tenant_id = b.tenant_id
from bookings b
where ci.booking_id = b.id
  and ci.tenant_id is null
  and b.tenant_id is not null;

update coach_training_items cti
set tenant_id = ci.tenant_id
from coach_insights ci
where cti.insight_id = ci.id
  and cti.tenant_id is null
  and ci.tenant_id is not null;

update coach_training_items
set tenant_id = '33333333-3333-3333-3333-333333333333'
where tenant_id is null;

update booking_credit_ledger bcl
set tenant_id = b.tenant_id
from bookings b
where bcl.booking_id = b.id
  and bcl.tenant_id is null
  and b.tenant_id is not null;

update booking_credit_ledger
set tenant_id = '33333333-3333-3333-3333-333333333333'
where tenant_id is null;

update replay_credit_ledger rcl
set tenant_id = b.tenant_id
from bookings b
where rcl.booking_id = b.id
  and rcl.tenant_id is null
  and b.tenant_id is not null;

update replay_credit_ledger rcl
set tenant_id = r.tenant_id
from replays r
where rcl.replay_id = r.id
  and rcl.tenant_id is null
  and r.tenant_id is not null;

update replay_credit_ledger rcl
set tenant_id = pp.tenant_id
from product_payments pp
where rcl.product_payment_id = pp.id
  and rcl.tenant_id is null
  and pp.tenant_id is not null;

update replay_credit_ledger
set tenant_id = '33333333-3333-3333-3333-333333333333'
where tenant_id is null;

update booking_credit_balances
set tenant_id = '33333333-3333-3333-3333-333333333333'
where tenant_id is null;

update replay_credit_balances
set tenant_id = '33333333-3333-3333-3333-333333333333'
where tenant_id is null;

update product_payments
set tenant_id = '33333333-3333-3333-3333-333333333333'
where tenant_id is null;

update coach_subscriptions
set tenant_id = '33333333-3333-3333-3333-333333333333'
where tenant_id is null;
