-- Phase 1 seed data for PlayTT MVP
-- Safe to rerun because inserts are idempotent on the chosen unique keys.

insert into locations (
  id,
  name,
  slug,
  address,
  timezone,
  is_active,
  notes
)
values (
  '11111111-1111-1111-1111-111111111111',
  'PlayTT Hurlingham',
  'playtt-hurlingham',
  'Hurlingham, Nairobi, Kenya',
  'Africa/Nairobi',
  true,
  'Initial MVP location'
)
on conflict (slug) do update
set
  name = excluded.name,
  address = excluded.address,
  timezone = excluded.timezone,
  is_active = excluded.is_active,
  notes = excluded.notes;

insert into resources (
  id,
  location_id,
  name,
  slug,
  type,
  capacity,
  sort_order,
  is_active,
  metadata
)
values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Hurlingham Main Pod',
  'hurlingham-main-pod',
  'pod',
  2,
  1,
  true,
  jsonb_build_object(
    'bookingDurations', jsonb_build_array(30, 60),
    'currency', 'KES',
    'gracePeriodMinutes', 5
  )
)
on conflict (location_id, slug) do update
set
  name = excluded.name,
  type = excluded.type,
  capacity = excluded.capacity,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  metadata = excluded.metadata;

insert into tenants (
  id,
  name,
  slug,
  status
)
values (
  '33333333-3333-3333-3333-333333333333',
  'PlayTT',
  'playtt',
  'active'
)
on conflict (id) do update
set
  name = excluded.name,
  slug = excluded.slug,
  status = excluded.status;

insert into brands (
  id,
  tenant_id,
  name,
  slug,
  is_default
)
values (
  '44444444-4444-4444-4444-444444444444',
  '33333333-3333-3333-3333-333333333333',
  'PlayTT',
  'playtt',
  true
)
on conflict (id) do update
set
  tenant_id = excluded.tenant_id,
  name = excluded.name,
  slug = excluded.slug,
  is_default = excluded.is_default;

insert into tenant_memberships (
  tenant_id,
  user_id,
  role,
  status
)
select
  '33333333-3333-3333-3333-333333333333',
  u.id,
  'customer',
  'active'
from "user" u
where not exists (
  select 1
  from tenant_memberships tm
  where tm.tenant_id = '33333333-3333-3333-3333-333333333333'
    and tm.user_id = u.id
);
