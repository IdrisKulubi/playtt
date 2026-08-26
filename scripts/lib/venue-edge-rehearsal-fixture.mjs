import { randomUUID } from "node:crypto"

export const REHEARSAL_TENANT_ID = "33333333-3333-3333-3333-333333333333"
export const REHEARSAL_LOCATION_ID = "11111111-1111-1111-1111-111111111111"
export const REHEARSAL_RESOURCE_ID = "22222222-2222-2222-2222-222222222222"
export const REHEARSAL_EDGE_DEVICE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
export const REHEARSAL_CAMERA_DEVICE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
export const REHEARSAL_ASSIGNMENT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"

export const VENUE_EDGE_TABLES = [
  "replay_recorders",
  "replay_camera_sources",
  "replay_source_routes",
  "replay_source_policies",
  "venue_edge_secret_refs",
  "venue_edge_installations",
  "venue_edge_config_revisions",
  "venue_edge_config_applications",
]

export async function assertVenueEdgeFoundationTables(sql) {
  const rows = await sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in ${sql(VENUE_EDGE_TABLES)}
  `
  const present = new Set(rows.map((row) => row.table_name))
  const missing = VENUE_EDGE_TABLES.filter((table) => !present.has(table))
  if (missing.length > 0) {
    throw new Error(`Missing VenueEdge foundation tables: ${missing.join(", ")}`)
  }
}

export async function seedSyntheticLegacyVenueEdgeAssignment(sql) {
  await sql`
    insert into devices (
      id, tenant_id, location_id, type, hardware_uid, status
    ) values (
      ${REHEARSAL_EDGE_DEVICE_ID}::uuid,
      ${REHEARSAL_TENANT_ID}::uuid,
      ${REHEARSAL_LOCATION_ID}::uuid,
      'venue_edge',
      'rehearsal-edge-hardware',
      'active'
    )
    on conflict (id) do nothing
  `

  await sql`
    insert into devices (
      id, tenant_id, location_id, type, hardware_uid, status
    ) values (
      ${REHEARSAL_CAMERA_DEVICE_ID}::uuid,
      ${REHEARSAL_TENANT_ID}::uuid,
      ${REHEARSAL_LOCATION_ID}::uuid,
      'camera',
      'rehearsal-camera-hardware',
      'active'
    )
    on conflict (id) do nothing
  `

  await sql`
    insert into device_assignments (
      id,
      tenant_id,
      device_id,
      location_id,
      resource_id,
      role,
      effective_from,
      config
    ) values (
      ${REHEARSAL_ASSIGNMENT_ID}::uuid,
      ${REHEARSAL_TENANT_ID}::uuid,
      ${REHEARSAL_EDGE_DEVICE_ID}::uuid,
      ${REHEARSAL_LOCATION_ID}::uuid,
      ${REHEARSAL_RESOURCE_ID}::uuid,
      'venue_edge',
      now() - interval '1 hour',
      ${JSON.stringify({
        cameraDeviceId: REHEARSAL_CAMERA_DEVICE_ID,
        camera: {
          label: "Rehearsal table camera",
          rtspUrl:
            "rtsp://rehearsal-user:rehearsal-password@192.168.50.10:554/live/2?token=never-copy",
        },
        nvr: {
          ip: "192.168.50.10",
          channel: 2,
          stream: "main",
          password: "also-never-copy",
        },
      })}::jsonb
    )
    on conflict (id) do nothing
  `
}

export async function loadLegacyRowsForRehearsal(sql) {
  const assignments = await sql`
    select
      da.id as assignment_id,
      da.tenant_id,
      da.location_id,
      da.resource_id,
      da.device_id,
      da.role,
      da.config
    from device_assignments da
    where da.id = ${REHEARSAL_ASSIGNMENT_ID}::uuid
  `

  const devices = await sql`
    select id, tenant_id, location_id, type
    from devices
    where tenant_id = ${REHEARSAL_TENANT_ID}::uuid
      and id in (
        ${REHEARSAL_EDGE_DEVICE_ID}::uuid,
        ${REHEARSAL_CAMERA_DEVICE_ID}::uuid
      )
  `

  const resources = await sql`
    select id, tenant_id, location_id, name
    from resources
    where id = ${REHEARSAL_RESOURCE_ID}::uuid
  `

  return {
    assignments: assignments.map((row) => ({
      assignmentId: row.assignment_id,
      tenantId: row.tenant_id,
      locationId: row.location_id,
      resourceId: row.resource_id,
      deviceId: row.device_id,
      role: row.role,
      config: row.config,
    })),
    devices: devices.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      locationId: row.location_id,
      type: row.type,
    })),
    resources: resources.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      locationId: row.location_id,
      name: row.name,
    })),
  }
}

export async function setVenueEdgeConfigV2Flag(sql, enabled, scope = null) {
  await sql`
    insert into feature_flags (tenant_id, key, enabled, scope)
    values (
      ${REHEARSAL_TENANT_ID}::uuid,
      'venue_edge_config_v2',
      ${enabled},
      ${scope ? JSON.stringify(scope) : null}::jsonb
    )
    on conflict (tenant_id, key)
    do update set
      enabled = excluded.enabled,
      scope = excluded.scope,
      updated_at = now()
  `
}

export function credentialFreeRehearsalReport(summary, inserted, skipped) {
  return {
    mode: inserted ? "apply" : "dry-run",
    ...summary,
    inserted: inserted ?? undefined,
    skipped,
    configPublished: false,
    evidence: "disposable-postgres-rehearsal",
    productionDatabaseMutated: false,
  }
}

export async function assertNoCredentialLeakInTopology(sql) {
  const serialized = JSON.stringify(
    await sql`
      select
        rr.host,
        rr.connection_config,
        rcs.live_stream_path,
        rcs.playback_config,
        vesr.local_key,
        vesr.username,
        vesr.status
      from replay_recorders rr
      join replay_camera_sources rcs on rcs.recorder_id = rr.id
      join venue_edge_secret_refs vesr on vesr.recorder_id = rr.id
      where rr.tenant_id = ${REHEARSAL_TENANT_ID}::uuid
        and rr.location_id = ${REHEARSAL_LOCATION_ID}::uuid
    `,
  )

  if (
    /rehearsal-password|rehearsal-user|also-never-copy|never-copy|rtsp:\/\//i.test(
      serialized,
    )
  ) {
    throw new Error("Topology rows contain credential-bearing legacy values.")
  }
}
