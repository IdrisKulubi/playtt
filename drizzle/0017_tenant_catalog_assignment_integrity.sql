CREATE UNIQUE INDEX "brands_tenant_id_unique" ON "brands" USING btree ("tenant_id","id");--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_tenant_brand_fk" FOREIGN KEY ("tenant_id","brand_id") REFERENCES "public"."brands"("tenant_id","id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "zones" ADD CONSTRAINT "zones_tenant_location_fk" FOREIGN KEY ("tenant_id","location_id") REFERENCES "public"."locations"("tenant_id","id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_tenant_location_fk" FOREIGN KEY ("tenant_id","location_id") REFERENCES "public"."locations"("tenant_id","id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_tenant_zone_fk" FOREIGN KEY ("tenant_id","zone_id") REFERENCES "public"."zones"("tenant_id","id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_tenant_resource_type_fk" FOREIGN KEY ("tenant_id","resource_type_id") REFERENCES "public"."resource_types"("tenant_id","id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "resource_capabilities" ADD CONSTRAINT "resource_capabilities_tenant_resource_fk" FOREIGN KEY ("tenant_id","resource_id") REFERENCES "public"."resources"("tenant_id","id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_tenant_venue_fk" FOREIGN KEY ("tenant_id","venue_id") REFERENCES "public"."locations"("tenant_id","id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_tenant_resource_fk" FOREIGN KEY ("tenant_id","resource_id") REFERENCES "public"."resources"("tenant_id","id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "locations" VALIDATE CONSTRAINT "locations_tenant_brand_fk";--> statement-breakpoint
ALTER TABLE "zones" VALIDATE CONSTRAINT "zones_tenant_location_fk";--> statement-breakpoint
ALTER TABLE "resources" VALIDATE CONSTRAINT "resources_tenant_location_fk";--> statement-breakpoint
ALTER TABLE "resources" VALIDATE CONSTRAINT "resources_tenant_zone_fk";--> statement-breakpoint
ALTER TABLE "resources" VALIDATE CONSTRAINT "resources_tenant_resource_type_fk";--> statement-breakpoint
ALTER TABLE "resource_capabilities" VALIDATE CONSTRAINT "resource_capabilities_tenant_resource_fk";--> statement-breakpoint
ALTER TABLE "outbox_events" VALIDATE CONSTRAINT "outbox_events_tenant_venue_fk";--> statement-breakpoint
ALTER TABLE "outbox_events" VALIDATE CONSTRAINT "outbox_events_tenant_resource_fk";--> statement-breakpoint
ALTER TABLE "device_assignments" ADD CONSTRAINT "device_assignments_device_window_excl" EXCLUDE USING gist (
	"tenant_id" WITH =,
	"device_id" WITH =,
	tstzrange("effective_from", coalesce("effective_to", 'infinity'::timestamptz), '[)') WITH &&
);--> statement-breakpoint
ALTER TABLE "device_assignments" ADD CONSTRAINT "device_assignments_score_input_window_excl" EXCLUDE USING gist (
	"tenant_id" WITH =,
	"resource_id" WITH =,
	tstzrange("effective_from", coalesce("effective_to", 'infinity'::timestamptz), '[)') WITH &&
) WHERE ("role" = 'score_input' AND "resource_id" IS NOT NULL);
