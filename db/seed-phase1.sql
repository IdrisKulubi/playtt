-- Phase 1 seed data for PlayTT MVP
-- Safe to rerun because inserts are idempotent on the chosen unique keys.

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

insert into locations (
  id,
  tenant_id,
  brand_id,
  name,
  slug,
  address,
  timezone,
  is_active,
  settings,
  archived_at,
  notes
)
values (
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
  'PlayTT Hurlingham',
  'playtt-hurlingham',
  'Hurlingham, Nairobi, Kenya',
  'Africa/Nairobi',
  true,
  jsonb_build_object('gracePeriodMinutes', 5),
  null,
  'Initial MVP location'
)
on conflict (slug) do update
set
  tenant_id = excluded.tenant_id,
  brand_id = excluded.brand_id,
  name = excluded.name,
  address = excluded.address,
  timezone = excluded.timezone,
  is_active = excluded.is_active,
  settings = excluded.settings,
  archived_at = excluded.archived_at,
  notes = excluded.notes;

insert into zones (
  id,
  tenant_id,
  location_id,
  name,
  slug,
  sort_order,
  is_active
)
values (
  '55555555-5555-5555-5555-555555555555',
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  'Main Hall',
  'main-hall',
  1,
  true
)
on conflict (id) do update
set
  tenant_id = excluded.tenant_id,
  location_id = excluded.location_id,
  name = excluded.name,
  slug = excluded.slug,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

insert into resource_types (
  id,
  tenant_id,
  code,
  name,
  description
)
values (
  '66666666-6666-6666-6666-666666666666',
  '33333333-3333-3333-3333-333333333333',
  'table_tennis_table',
  'Table Tennis Table',
  'Standard table tennis table resource'
)
on conflict (id) do update
set
  tenant_id = excluded.tenant_id,
  code = excluded.code,
  name = excluded.name,
  description = excluded.description;

insert into resources (
  id,
  tenant_id,
  location_id,
  zone_id,
  resource_type_id,
  name,
  slug,
  code,
  type,
  ruleset,
  capacity,
  sort_order,
  is_active,
  metadata
)
values (
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  '55555555-5555-5555-5555-555555555555',
  '66666666-6666-6666-6666-666666666666',
  'Hurlingham Main Pod',
  'hurlingham-main-pod',
  'Table 01',
  'pod',
  'tt_standard_v1',
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
  tenant_id = excluded.tenant_id,
  zone_id = excluded.zone_id,
  resource_type_id = excluded.resource_type_id,
  name = excluded.name,
  code = excluded.code,
  type = excluded.type,
  ruleset = excluded.ruleset,
  capacity = excluded.capacity,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  metadata = excluded.metadata;

insert into resource_capabilities (
  tenant_id,
  resource_id,
  code
)
select
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222',
  capability_code
from (
  values
    ('scoring'),
    ('replay'),
    ('access'),
    ('lighting'),
    ('display'),
    ('camera')
) as capabilities(capability_code)
where not exists (
  select 1
  from resource_capabilities rc
  where rc.resource_id = '22222222-2222-2222-2222-222222222222'
    and rc.code = capabilities.capability_code
);

insert into access_points (
  id,
  tenant_id,
  location_id,
  zone_id,
  code,
  name,
  kind,
  sort_order,
  is_active
)
values
  (
    '77777777-7777-7777-7777-777777777777',
    '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    null,
    'main-entrance',
    'Hurlingham Main Entrance',
    'entrance',
    1,
    true
  ),
  (
    '88888888-8888-8888-8888-888888888888',
    '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    '55555555-5555-5555-5555-555555555555',
    'main-hall-door',
    'Main Hall Door',
    'hall',
    2,
    true
  )
on conflict (id) do update
set
  tenant_id = excluded.tenant_id,
  location_id = excluded.location_id,
  zone_id = excluded.zone_id,
  code = excluded.code,
  name = excluded.name,
  kind = excluded.kind,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

insert into access_point_resources (
  tenant_id,
  access_point_id,
  resource_id,
  sort_order
)
select
  '33333333-3333-3333-3333-333333333333',
  access_point_id,
  '22222222-2222-2222-2222-222222222222',
  sort_order
from (
  values
    ('77777777-7777-7777-7777-777777777777'::uuid, 1),
    ('88888888-8888-8888-8888-888888888888'::uuid, 2)
) as mappings(access_point_id, sort_order)
where not exists (
  select 1
  from access_point_resources apr
  where apr.access_point_id = mappings.access_point_id
    and apr.resource_id = '22222222-2222-2222-2222-222222222222'
);

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

insert into feature_flags (
  tenant_id,
  key,
  enabled
)
select
  '33333333-3333-3333-3333-333333333333',
  flags.key,
  true
from (
  values
    ('operator_shell'),
    ('device_registry'),
    ('private_media'),
    ('replay_edge')
) as flags(key)
where not exists (
  select 1
  from feature_flags ff
  where ff.tenant_id = '33333333-3333-3333-3333-333333333333'
    and ff.key = flags.key
);
