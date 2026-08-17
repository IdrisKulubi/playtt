CREATE TYPE "public"."play_session_status" AS ENUM('held', 'confirmed', 'preparing', 'active', 'ending', 'completed', 'resetting', 'available');--> statement-breakpoint
CREATE TYPE "public"."session_participant_role" AS ENUM('owner', 'guest');--> statement-breakpoint
CREATE TABLE "play_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"booking_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"status" "play_session_status" DEFAULT 'confirmed' NOT NULL,
	"correlation_id" text NOT NULL,
	"scheduled_start_at" timestamp with time zone NOT NULL,
	"scheduled_end_at" timestamp with time zone NOT NULL,
	"prepared_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"reset_at" timestamp with time zone,
	"configuration_snapshot" jsonb NOT NULL,
	"configuration_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"play_session_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "session_participant_role" DEFAULT 'owner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "play_session_id" uuid;--> statement-breakpoint
ALTER TABLE "access_credentials" ADD COLUMN "play_session_id" uuid;--> statement-breakpoint
ALTER TABLE "session_events" ADD COLUMN "play_session_id" uuid;--> statement-breakpoint
ALTER TABLE "replays" ADD COLUMN "play_session_id" uuid;--> statement-breakpoint
ALTER TABLE "play_sessions" ADD CONSTRAINT "play_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_sessions" ADD CONSTRAINT "play_sessions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_sessions" ADD CONSTRAINT "play_sessions_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_sessions" ADD CONSTRAINT "play_sessions_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_play_session_id_play_sessions_id_fk" FOREIGN KEY ("play_session_id") REFERENCES "public"."play_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_play_session_id_play_sessions_id_fk" FOREIGN KEY ("play_session_id") REFERENCES "public"."play_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_credentials" ADD CONSTRAINT "access_credentials_play_session_id_play_sessions_id_fk" FOREIGN KEY ("play_session_id") REFERENCES "public"."play_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_events" ADD CONSTRAINT "session_events_play_session_id_play_sessions_id_fk" FOREIGN KEY ("play_session_id") REFERENCES "public"."play_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replays" ADD CONSTRAINT "replays_play_session_id_play_sessions_id_fk" FOREIGN KEY ("play_session_id") REFERENCES "public"."play_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "play_sessions_booking_id_unique" ON "play_sessions" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "play_sessions_tenant_id_unique" ON "play_sessions" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "play_sessions_tenant_booking_unique" ON "play_sessions" USING btree ("tenant_id","booking_id");--> statement-breakpoint
CREATE INDEX "play_sessions_tenant_id_idx" ON "play_sessions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "play_sessions_status_idx" ON "play_sessions" USING btree ("status","scheduled_start_at");--> statement-breakpoint
CREATE UNIQUE INDEX "session_participants_session_user_unique" ON "session_participants" USING btree ("play_session_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_participants_tenant_id_unique" ON "session_participants" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "session_participants_tenant_id_idx" ON "session_participants" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "session_participants_play_session_id_idx" ON "session_participants" USING btree ("play_session_id");--> statement-breakpoint
CREATE INDEX "matches_play_session_id_idx" ON "matches" USING btree ("play_session_id");--> statement-breakpoint
CREATE INDEX "access_credentials_play_session_id_idx" ON "access_credentials" USING btree ("play_session_id");--> statement-breakpoint
CREATE INDEX "session_events_play_session_id_idx" ON "session_events" USING btree ("play_session_id");--> statement-breakpoint
CREATE INDEX "replays_play_session_id_idx" ON "replays" USING btree ("play_session_id");--> statement-breakpoint
ALTER TABLE "play_sessions" ADD CONSTRAINT "play_sessions_scheduled_window" CHECK ("scheduled_end_at" > "scheduled_start_at");--> statement-breakpoint
ALTER TABLE "play_sessions" ADD CONSTRAINT "play_sessions_tenant_booking_fk" FOREIGN KEY ("tenant_id","booking_id") REFERENCES "public"."bookings"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "play_sessions" ADD CONSTRAINT "play_sessions_tenant_location_fk" FOREIGN KEY ("tenant_id","location_id") REFERENCES "public"."locations"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "play_sessions" ADD CONSTRAINT "play_sessions_tenant_resource_fk" FOREIGN KEY ("tenant_id","resource_id") REFERENCES "public"."resources"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_tenant_play_session_fk" FOREIGN KEY ("tenant_id","play_session_id") REFERENCES "public"."play_sessions"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "play_sessions" VALIDATE CONSTRAINT "play_sessions_tenant_booking_fk";--> statement-breakpoint
ALTER TABLE "play_sessions" VALIDATE CONSTRAINT "play_sessions_tenant_location_fk";--> statement-breakpoint
ALTER TABLE "play_sessions" VALIDATE CONSTRAINT "play_sessions_tenant_resource_fk";--> statement-breakpoint
ALTER TABLE "session_participants" VALIDATE CONSTRAINT "session_participants_tenant_play_session_fk";
