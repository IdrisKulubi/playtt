CREATE TABLE "resource_capabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"code" text NOT NULL,
	"config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_types" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zones" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "brand_id" uuid;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "settings" jsonb;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "zone_id" uuid;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "resource_type_id" uuid;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "code" text;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "ruleset" text;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "configuration" jsonb;--> statement-breakpoint
ALTER TABLE "resource_capabilities" ADD CONSTRAINT "resource_capabilities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_capabilities" ADD CONSTRAINT "resource_capabilities_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_types" ADD CONSTRAINT "resource_types_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zones" ADD CONSTRAINT "zones_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zones" ADD CONSTRAINT "zones_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "resource_capabilities_resource_code_unique" ON "resource_capabilities" USING btree ("resource_id","code");--> statement-breakpoint
CREATE INDEX "resource_capabilities_tenant_id_idx" ON "resource_capabilities" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "resource_capabilities_resource_id_idx" ON "resource_capabilities" USING btree ("resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_types_tenant_code_unique" ON "resource_types" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_types_tenant_id_unique" ON "resource_types" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "resource_types_tenant_id_idx" ON "resource_types" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "zones_tenant_location_slug_unique" ON "zones" USING btree ("tenant_id","location_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "zones_tenant_id_unique" ON "zones" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "zones_location_id_idx" ON "zones" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "zones_tenant_id_idx" ON "zones" USING btree ("tenant_id");--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_resource_type_id_resource_types_id_fk" FOREIGN KEY ("resource_type_id") REFERENCES "public"."resource_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "locations_tenant_id_idx" ON "locations" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "locations_tenant_slug_unique" ON "locations" USING btree ("tenant_id","slug") WHERE "locations"."tenant_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "locations_tenant_id_unique" ON "locations" USING btree ("tenant_id","id") WHERE "locations"."tenant_id" is not null;--> statement-breakpoint
CREATE INDEX "resources_tenant_id_idx" ON "resources" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "resources_tenant_location_code_unique" ON "resources" USING btree ("tenant_id","location_id","code") WHERE "resources"."code" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "resources_tenant_id_unique" ON "resources" USING btree ("tenant_id","id") WHERE "resources"."tenant_id" is not null;