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
