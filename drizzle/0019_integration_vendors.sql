CREATE TYPE "public"."integration_vendor_kind" AS ENUM('ttlock', 'camera', 'esp32', 'paystack', 'other');--> statement-breakpoint
CREATE TYPE "public"."integration_vendor_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."venue_integration_status" AS ENUM('active', 'inactive', 'pending');--> statement-breakpoint
CREATE TABLE "integration_vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "integration_vendor_kind" NOT NULL,
	"status" "integration_vendor_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"location_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"status" "venue_integration_status" DEFAULT 'pending' NOT NULL,
	"config" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_vendors" ADD CONSTRAINT "integration_vendors_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_integrations" ADD CONSTRAINT "venue_integrations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_integrations" ADD CONSTRAINT "venue_integrations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_integrations" ADD CONSTRAINT "venue_integrations_vendor_id_integration_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."integration_vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "integration_vendors_tenant_id_unique" ON "integration_vendors" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "integration_vendors_tenant_id_idx" ON "integration_vendors" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "integration_vendors_tenant_status_idx" ON "integration_vendors" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "venue_integrations_tenant_id_unique" ON "venue_integrations" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "venue_integrations_tenant_location_vendor_unique" ON "venue_integrations" USING btree ("tenant_id","location_id","vendor_id");--> statement-breakpoint
CREATE INDEX "venue_integrations_tenant_id_idx" ON "venue_integrations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "venue_integrations_location_id_idx" ON "venue_integrations" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "venue_integrations_vendor_id_idx" ON "venue_integrations" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "venue_integrations_tenant_status_idx" ON "venue_integrations" USING btree ("tenant_id","status");--> statement-breakpoint
ALTER TABLE "venue_integrations" ADD CONSTRAINT "venue_integrations_tenant_location_fk" FOREIGN KEY ("tenant_id","location_id") REFERENCES "public"."locations"("tenant_id","id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "venue_integrations" ADD CONSTRAINT "venue_integrations_tenant_vendor_fk" FOREIGN KEY ("tenant_id","vendor_id") REFERENCES "public"."integration_vendors"("tenant_id","id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "venue_integrations" VALIDATE CONSTRAINT "venue_integrations_tenant_location_fk";--> statement-breakpoint
ALTER TABLE "venue_integrations" VALIDATE CONSTRAINT "venue_integrations_tenant_vendor_fk";
