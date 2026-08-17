DROP INDEX IF EXISTS "locations_tenant_id_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "locations_tenant_id_unique" ON "locations" USING btree ("tenant_id","id");--> statement-breakpoint
DROP INDEX IF EXISTS "resources_tenant_id_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "resources_tenant_id_unique" ON "resources" USING btree ("tenant_id","id");--> statement-breakpoint
DROP INDEX IF EXISTS "bookings_tenant_id_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_tenant_id_unique" ON "bookings" USING btree ("tenant_id","id");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tenant_location_fk" FOREIGN KEY ("tenant_id","location_id") REFERENCES "public"."locations"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tenant_resource_fk" FOREIGN KEY ("tenant_id","resource_id") REFERENCES "public"."resources"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_booking_fk" FOREIGN KEY ("tenant_id","booking_id") REFERENCES "public"."bookings"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "booking_modifications" ADD CONSTRAINT "booking_modifications_tenant_booking_fk" FOREIGN KEY ("tenant_id","booking_id") REFERENCES "public"."bookings"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_tenant_booking_fk" FOREIGN KEY ("tenant_id","booking_id") REFERENCES "public"."bookings"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "access_credentials" ADD CONSTRAINT "access_credentials_tenant_booking_fk" FOREIGN KEY ("tenant_id","booking_id") REFERENCES "public"."bookings"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "session_events" ADD CONSTRAINT "session_events_tenant_booking_fk" FOREIGN KEY ("tenant_id","booking_id") REFERENCES "public"."bookings"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_tenant_booking_fk" FOREIGN KEY ("tenant_id","booking_id") REFERENCES "public"."bookings"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "replays" ADD CONSTRAINT "replays_tenant_booking_fk" FOREIGN KEY ("tenant_id","booking_id") REFERENCES "public"."bookings"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "hardware_configs" ADD CONSTRAINT "hardware_configs_tenant_location_fk" FOREIGN KEY ("tenant_id","location_id") REFERENCES "public"."locations"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "bookings" VALIDATE CONSTRAINT "bookings_tenant_location_fk";--> statement-breakpoint
ALTER TABLE "bookings" VALIDATE CONSTRAINT "bookings_tenant_resource_fk";--> statement-breakpoint
ALTER TABLE "payments" VALIDATE CONSTRAINT "payments_tenant_booking_fk";--> statement-breakpoint
ALTER TABLE "booking_modifications" VALIDATE CONSTRAINT "booking_modifications_tenant_booking_fk";--> statement-breakpoint
ALTER TABLE "booking_status_history" VALIDATE CONSTRAINT "booking_status_history_tenant_booking_fk";--> statement-breakpoint
ALTER TABLE "access_credentials" VALIDATE CONSTRAINT "access_credentials_tenant_booking_fk";--> statement-breakpoint
ALTER TABLE "session_events" VALIDATE CONSTRAINT "session_events_tenant_booking_fk";--> statement-breakpoint
ALTER TABLE "matches" VALIDATE CONSTRAINT "matches_tenant_booking_fk";--> statement-breakpoint
ALTER TABLE "replays" VALIDATE CONSTRAINT "replays_tenant_booking_fk";--> statement-breakpoint
ALTER TABLE "hardware_configs" VALIDATE CONSTRAINT "hardware_configs_tenant_location_fk";
