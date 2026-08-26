export async function applyLegacyVenueEdgeTopologyPlan(sql, plan) {
  return sql.begin(async (tx) => {
    const inserted = {
      recorders: 0,
      sources: 0,
      routes: 0,
      policies: 0,
      unresolvedLocalSecretRefs: 0,
    }

    for (const row of plan.recorders) {
      const result = await tx`
        insert into replay_recorders (
          id, tenant_id, location_id, label, vendor, host, rtsp_port,
          connection_config, is_enabled
        ) values (
          ${row.id}::uuid, ${row.tenantId}::uuid, ${row.locationId}::uuid,
          ${row.label}, ${row.vendor}, ${row.host}, ${row.rtspPort},
          ${JSON.stringify(row.connectionConfig)}::jsonb, ${row.isEnabled}
        )
        on conflict (id) do nothing
        returning id
      `
      inserted.recorders += result.length
    }

    for (const row of plan.sources) {
      const result = await tx`
        insert into replay_camera_sources (
          id, tenant_id, location_id, recorder_id, camera_device_id,
          channel_key, stream_profile, label, live_stream_path,
          playback_config, capabilities, is_enabled
        ) values (
          ${row.id}::uuid, ${row.tenantId}::uuid, ${row.locationId}::uuid,
          ${row.recorderId}::uuid, ${row.cameraDeviceId}::uuid,
          ${row.channelKey}, ${row.streamProfile}, ${row.label},
          ${row.liveStreamPath}, ${JSON.stringify(row.playbackConfig)}::jsonb,
          ${JSON.stringify(row.capabilities)}::jsonb, ${row.isEnabled}
        )
        on conflict (id) do nothing
        returning id
      `
      inserted.sources += result.length
    }

    for (const row of plan.routes) {
      const result = await tx`
        insert into replay_source_routes (
          id, tenant_id, location_id, resource_id, camera_source_id,
          priority, capture_modes, policy, is_enabled
        ) values (
          ${row.id}::uuid, ${row.tenantId}::uuid, ${row.locationId}::uuid,
          ${row.resourceId}::uuid, ${row.cameraSourceId}::uuid,
          ${row.priority}, ${tx.array(row.captureModes)}::replay_source_capture_mode[],
          ${JSON.stringify(row.policy)}::jsonb, ${row.isEnabled}
        )
        on conflict (id) do nothing
        returning id
      `
      inserted.routes += result.length
    }

    for (const row of plan.policies) {
      const result = await tx`
        insert into replay_source_policies (
          id, tenant_id, location_id, resource_id, selection_mode,
          manual_source_id, failure_threshold, healthy_threshold,
          cooldown_seconds, auto_failback
        ) values (
          ${row.id}::uuid, ${row.tenantId}::uuid, ${row.locationId}::uuid,
          ${row.resourceId}::uuid, ${row.selectionMode},
          ${row.manualSourceId}::uuid, ${row.failureThreshold},
          ${row.healthyThreshold}, ${row.cooldownSeconds}, ${row.autoFailback}
        )
        on conflict (tenant_id, location_id, resource_id) do nothing
        returning id
      `
      inserted.policies += result.length
    }

    for (const row of plan.secretRefs) {
      const result = await tx`
        insert into venue_edge_secret_refs (
          id, tenant_id, location_id, edge_device_id, recorder_id,
          local_key, credential_version, username, status
        ) values (
          ${row.id}::uuid, ${row.tenantId}::uuid, ${row.locationId}::uuid,
          ${row.edgeDeviceId}::uuid, ${row.recorderId}::uuid,
          ${row.localKey}, ${row.credentialVersion}, ${row.username}, ${row.status}
        )
        on conflict (tenant_id, edge_device_id, recorder_id, credential_version)
        do nothing
        returning id
      `
      inserted.unresolvedLocalSecretRefs += result.length
    }

    return inserted
  })
}
