CREATE TABLE "venue_edge_releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001' NOT NULL,
	"version" text NOT NULL,
	"channel" text NOT NULL,
	"platform" text NOT NULL,
	"architecture" text NOT NULL,
	"artifact_url" text NOT NULL,
	"sha256" text NOT NULL,
	"signature" text NOT NULL,
	"min_supported_version" text NOT NULL,
	"rollout_cohort" text,
	"rollout_percentage" integer DEFAULT 100 NOT NULL,
	"canary_installation_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"deadline" timestamp with time zone,
	"status" text DEFAULT 'draft' NOT NULL,
	"release_notes" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venue_edge_releases_rollout_percentage_valid" CHECK ("venue_edge_releases"."rollout_percentage" >= 0 and "venue_edge_releases"."rollout_percentage" <= 100),
	CONSTRAINT "venue_edge_releases_checksum_present" CHECK (length("venue_edge_releases"."sha256") > 0 and length("venue_edge_releases"."signature") > 0)
);
--> statement-breakpoint
CREATE TABLE "venue_edge_update_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001' NOT NULL,
	"location_id" uuid NOT NULL,
	"installation_id" uuid NOT NULL,
	"release_id" uuid NOT NULL,
	"edge_device_id" uuid NOT NULL,
	"target_version" text NOT NULL,
	"status" text DEFAULT 'started' NOT NULL,
	"reason_code" text,
	"correlation_id" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "venue_edge_installations" ADD COLUMN "update_status" text DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE "venue_edge_installations" ADD COLUMN "pinned_version" text;--> statement-breakpoint
ALTER TABLE "venue_edge_installations" ADD COLUMN "active_update_attempt_id" uuid;--> statement-breakpoint
ALTER TABLE "venue_edge_installations" ADD COLUMN "last_update_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "venue_edge_installations" ADD COLUMN "last_update_error_code" text;--> statement-breakpoint
ALTER TABLE "venue_edge_releases" ADD CONSTRAINT "venue_edge_releases_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_edge_update_attempts" ADD CONSTRAINT "venue_edge_update_attempts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_edge_update_attempts" ADD CONSTRAINT "venue_edge_update_attempts_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_edge_update_attempts" ADD CONSTRAINT "venue_edge_update_attempts_tenant_location_installation_fk" FOREIGN KEY ("tenant_id","location_id","installation_id") REFERENCES "public"."venue_edge_installations"("tenant_id","location_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_edge_update_attempts" ADD CONSTRAINT "venue_edge_update_attempts_tenant_release_fk" FOREIGN KEY ("tenant_id","release_id") REFERENCES "public"."venue_edge_releases"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_edge_update_attempts" ADD CONSTRAINT "venue_edge_update_attempts_tenant_location_device_fk" FOREIGN KEY ("tenant_id","location_id","edge_device_id") REFERENCES "public"."devices"("tenant_id","location_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "venue_edge_releases_tenant_id_unique" ON "venue_edge_releases" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "venue_edge_releases_version_channel_platform_arch_unique" ON "venue_edge_releases" USING btree ("tenant_id","version","channel","platform","architecture");--> statement-breakpoint
CREATE INDEX "venue_edge_releases_channel_status_idx" ON "venue_edge_releases" USING btree ("tenant_id","channel","status","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "venue_edge_update_attempts_tenant_id_unique" ON "venue_edge_update_attempts" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "venue_edge_update_attempts_installation_started_idx" ON "venue_edge_update_attempts" USING btree ("tenant_id","installation_id","started_at");
