CREATE TYPE "public"."access_point_kind" AS ENUM('entrance', 'hall', 'resource');--> statement-breakpoint
CREATE TABLE "access_points" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"zone_id" uuid,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"kind" "access_point_kind" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "access_point_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"access_point_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "access_points" ADD CONSTRAINT "access_points_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_points" ADD CONSTRAINT "access_points_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_points" ADD CONSTRAINT "access_points_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_point_resources" ADD CONSTRAINT "access_point_resources_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_point_resources" ADD CONSTRAINT "access_point_resources_access_point_id_access_points_id_fk" FOREIGN KEY ("access_point_id") REFERENCES "public"."access_points"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_point_resources" ADD CONSTRAINT "access_point_resources_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "access_points_tenant_location_code_unique" ON "access_points" USING btree ("tenant_id","location_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "access_points_tenant_id_unique" ON "access_points" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "access_points_tenant_id_idx" ON "access_points" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "access_points_location_id_idx" ON "access_points" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "access_points_zone_id_idx" ON "access_points" USING btree ("zone_id");--> statement-breakpoint
CREATE UNIQUE INDEX "access_point_resources_point_resource_unique" ON "access_point_resources" USING btree ("access_point_id","resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX "access_point_resources_tenant_id_unique" ON "access_point_resources" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "access_point_resources_tenant_id_idx" ON "access_point_resources" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "access_point_resources_access_point_id_idx" ON "access_point_resources" USING btree ("access_point_id");--> statement-breakpoint
CREATE INDEX "access_point_resources_resource_id_idx" ON "access_point_resources" USING btree ("resource_id");--> statement-breakpoint
ALTER TABLE "access_points" ADD CONSTRAINT "access_points_tenant_location_fk" FOREIGN KEY ("tenant_id","location_id") REFERENCES "public"."locations"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "access_points" ADD CONSTRAINT "access_points_tenant_zone_fk" FOREIGN KEY ("tenant_id","zone_id") REFERENCES "public"."zones"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "access_point_resources" ADD CONSTRAINT "access_point_resources_tenant_access_point_fk" FOREIGN KEY ("tenant_id","access_point_id") REFERENCES "public"."access_points"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "access_point_resources" ADD CONSTRAINT "access_point_resources_tenant_resource_fk" FOREIGN KEY ("tenant_id","resource_id") REFERENCES "public"."resources"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "access_points" VALIDATE CONSTRAINT "access_points_tenant_location_fk";--> statement-breakpoint
ALTER TABLE "access_points" VALIDATE CONSTRAINT "access_points_tenant_zone_fk";--> statement-breakpoint
ALTER TABLE "access_point_resources" VALIDATE CONSTRAINT "access_point_resources_tenant_access_point_fk";--> statement-breakpoint
ALTER TABLE "access_point_resources" VALIDATE CONSTRAINT "access_point_resources_tenant_resource_fk";
