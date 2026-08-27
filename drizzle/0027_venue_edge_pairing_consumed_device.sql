ALTER TABLE "venue_edge_pairing_sessions" ADD COLUMN "consumed_device_id" uuid;--> statement-breakpoint
ALTER TABLE "venue_edge_pairing_sessions" ADD CONSTRAINT "venue_edge_pairing_sessions_consumed_device_id_devices_id_fk" FOREIGN KEY ("consumed_device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "venue_edge_pairing_sessions_consumed_device_idx" ON "venue_edge_pairing_sessions" USING btree ("consumed_device_id");
