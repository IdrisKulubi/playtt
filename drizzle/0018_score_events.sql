CREATE TYPE "public"."score_event_kind" AS ENUM('point', 'correction');--> statement-breakpoint
CREATE TYPE "public"."score_side" AS ENUM('a', 'b');--> statement-breakpoint
CREATE TABLE "score_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"device_id" uuid NOT NULL,
	"play_session_id" uuid NOT NULL,
	"assignment_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"boot_id" text NOT NULL,
	"sequence" integer NOT NULL,
	"kind" "score_event_kind" NOT NULL,
	"side" "score_side" NOT NULL,
	"delta" integer DEFAULT 1 NOT NULL,
	"ruleset" text NOT NULL,
	"correlation_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "score_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"play_session_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"state" jsonb NOT NULL,
	"last_event_id" uuid,
	"last_sequence" integer,
	"last_boot_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "score_events" ADD CONSTRAINT "score_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_events" ADD CONSTRAINT "score_events_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_events" ADD CONSTRAINT "score_events_play_session_id_play_sessions_id_fk" FOREIGN KEY ("play_session_id") REFERENCES "public"."play_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_events" ADD CONSTRAINT "score_events_assignment_id_device_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."device_assignments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_events" ADD CONSTRAINT "score_events_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_events" ADD CONSTRAINT "score_events_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_snapshots" ADD CONSTRAINT "score_snapshots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_snapshots" ADD CONSTRAINT "score_snapshots_play_session_id_play_sessions_id_fk" FOREIGN KEY ("play_session_id") REFERENCES "public"."play_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_snapshots" ADD CONSTRAINT "score_snapshots_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_snapshots" ADD CONSTRAINT "score_snapshots_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_snapshots" ADD CONSTRAINT "score_snapshots_last_event_id_score_events_id_fk" FOREIGN KEY ("last_event_id") REFERENCES "public"."score_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "score_events_device_boot_sequence_unique" ON "score_events" USING btree ("device_id","boot_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "score_events_tenant_id_unique" ON "score_events" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "score_events_tenant_id_idx" ON "score_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "score_events_play_session_id_idx" ON "score_events" USING btree ("play_session_id");--> statement-breakpoint
CREATE INDEX "score_events_device_id_idx" ON "score_events" USING btree ("device_id");--> statement-breakpoint
CREATE UNIQUE INDEX "score_snapshots_play_session_unique" ON "score_snapshots" USING btree ("play_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "score_snapshots_tenant_id_unique" ON "score_snapshots" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "score_snapshots_tenant_id_idx" ON "score_snapshots" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "score_snapshots_resource_id_idx" ON "score_snapshots" USING btree ("resource_id");--> statement-breakpoint
ALTER TABLE "score_events" ADD CONSTRAINT "score_events_tenant_device_fk" FOREIGN KEY ("tenant_id","device_id") REFERENCES "public"."devices"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "score_events" ADD CONSTRAINT "score_events_tenant_play_session_fk" FOREIGN KEY ("tenant_id","play_session_id") REFERENCES "public"."play_sessions"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "score_events" ADD CONSTRAINT "score_events_tenant_assignment_fk" FOREIGN KEY ("tenant_id","assignment_id") REFERENCES "public"."device_assignments"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "score_events" ADD CONSTRAINT "score_events_tenant_resource_fk" FOREIGN KEY ("tenant_id","resource_id") REFERENCES "public"."resources"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "score_events" ADD CONSTRAINT "score_events_tenant_location_fk" FOREIGN KEY ("tenant_id","location_id") REFERENCES "public"."locations"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "score_snapshots" ADD CONSTRAINT "score_snapshots_tenant_play_session_fk" FOREIGN KEY ("tenant_id","play_session_id") REFERENCES "public"."play_sessions"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "score_snapshots" ADD CONSTRAINT "score_snapshots_tenant_resource_fk" FOREIGN KEY ("tenant_id","resource_id") REFERENCES "public"."resources"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "score_snapshots" ADD CONSTRAINT "score_snapshots_tenant_location_fk" FOREIGN KEY ("tenant_id","location_id") REFERENCES "public"."locations"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "score_events" VALIDATE CONSTRAINT "score_events_tenant_device_fk";--> statement-breakpoint
ALTER TABLE "score_events" VALIDATE CONSTRAINT "score_events_tenant_play_session_fk";--> statement-breakpoint
ALTER TABLE "score_events" VALIDATE CONSTRAINT "score_events_tenant_assignment_fk";--> statement-breakpoint
ALTER TABLE "score_events" VALIDATE CONSTRAINT "score_events_tenant_resource_fk";--> statement-breakpoint
ALTER TABLE "score_events" VALIDATE CONSTRAINT "score_events_tenant_location_fk";--> statement-breakpoint
ALTER TABLE "score_snapshots" VALIDATE CONSTRAINT "score_snapshots_tenant_play_session_fk";--> statement-breakpoint
ALTER TABLE "score_snapshots" VALIDATE CONSTRAINT "score_snapshots_tenant_resource_fk";--> statement-breakpoint
ALTER TABLE "score_snapshots" VALIDATE CONSTRAINT "score_snapshots_tenant_location_fk";
