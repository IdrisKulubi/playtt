ALTER TABLE "venue_edge_pairing_sessions" DROP CONSTRAINT "venue_edge_pairing_sessions_consumed_device_id_devices_id_fk";
--> statement-breakpoint
ALTER TABLE "venue_edge_pairing_sessions" ADD CONSTRAINT "venue_edge_pairing_sessions_consumed_tenant_device_fk" FOREIGN KEY ("tenant_id","consumed_device_id") REFERENCES "public"."devices"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "venue_edge_pairing_sessions_code_hash_unique" ON "venue_edge_pairing_sessions" USING btree ("code_hash");--> statement-breakpoint
ALTER TABLE "venue_edge_pairing_sessions" ADD CONSTRAINT "venue_edge_pairing_sessions_lifecycle_consistent" CHECK ((
        ("venue_edge_pairing_sessions"."status" = 'waiting_for_install' and "venue_edge_pairing_sessions"."cancelled_at" is null and "venue_edge_pairing_sessions"."consumed_at" is null and "venue_edge_pairing_sessions"."consumed_device_id" is null)
        or ("venue_edge_pairing_sessions"."status" = 'cancelled' and "venue_edge_pairing_sessions"."cancelled_at" is not null and "venue_edge_pairing_sessions"."consumed_at" is null and "venue_edge_pairing_sessions"."consumed_device_id" is null)
        or ("venue_edge_pairing_sessions"."status" = 'expired' and "venue_edge_pairing_sessions"."cancelled_at" is null and "venue_edge_pairing_sessions"."consumed_at" is null and "venue_edge_pairing_sessions"."consumed_device_id" is null)
        or ("venue_edge_pairing_sessions"."status" = 'consumed' and "venue_edge_pairing_sessions"."cancelled_at" is null and "venue_edge_pairing_sessions"."consumed_at" is not null and "venue_edge_pairing_sessions"."consumed_device_id" is not null)
      )) NOT VALID;
