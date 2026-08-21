ALTER TYPE "public"."device_type" ADD VALUE IF NOT EXISTS 'venue_edge';--> statement-breakpoint
ALTER TYPE "public"."device_type" ADD VALUE IF NOT EXISTS 'camera';--> statement-breakpoint
ALTER TYPE "public"."device_assignment_role" ADD VALUE IF NOT EXISTS 'venue_edge';--> statement-breakpoint
ALTER TYPE "public"."device_assignment_role" ADD VALUE IF NOT EXISTS 'replay_primary';--> statement-breakpoint
ALTER TYPE "public"."device_assignment_role" ADD VALUE IF NOT EXISTS 'replay_secondary';--> statement-breakpoint
ALTER TYPE "public"."device_assignment_role" ADD VALUE IF NOT EXISTS 'security_camera';--> statement-breakpoint
ALTER TYPE "public"."device_command_kind" ADD VALUE IF NOT EXISTS 'capture_replay';--> statement-breakpoint
CREATE TYPE "public"."replay_request_status" AS ENUM('requested', 'authorized', 'dispatched', 'edge_acknowledged', 'capturing', 'extracting', 'uploading', 'verifying', 'ready', 'edge_offline', 'buffer_missing', 'extraction_failed', 'upload_failed', 'expired', 'failed');--> statement-breakpoint
CREATE TYPE "public"."replay_capture_source" AS ENUM('edge_buffer', 'nvr_playback');--> statement-breakpoint
CREATE TABLE "replay_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"location_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"play_session_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"requester_user_id" text NOT NULL,
	"replay_id" uuid NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"venue_edge_device_id" uuid,
	"camera_device_id" uuid,
	"assignment_id" uuid,
	"source_type" "replay_capture_source" NOT NULL,
	"capture_at" timestamp with time zone NOT NULL,
	"pre_roll_seconds" integer DEFAULT 12 NOT NULL,
	"post_roll_seconds" integer DEFAULT 3 NOT NULL,
	"status" "replay_request_status" DEFAULT 'requested' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"correlation_id" text NOT NULL,
	"client_idempotency_key" text NOT NULL,
	"device_command_id" uuid,
	"failure_reason" text,
	"dispatched_at" timestamp with time zone,
	"edge_acknowledged_at" timestamp with time zone,
	"capturing_at" timestamp with time zone,
	"extracting_at" timestamp with time zone,
	"uploading_at" timestamp with time zone,
	"verifying_at" timestamp with time zone,
	"ready_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "replay_requests" ADD CONSTRAINT "replay_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_requests" ADD CONSTRAINT "replay_requests_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_requests" ADD CONSTRAINT "replay_requests_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_requests" ADD CONSTRAINT "replay_requests_play_session_id_play_sessions_id_fk" FOREIGN KEY ("play_session_id") REFERENCES "public"."play_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_requests" ADD CONSTRAINT "replay_requests_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_requests" ADD CONSTRAINT "replay_requests_requester_user_id_user_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_requests" ADD CONSTRAINT "replay_requests_replay_id_replays_id_fk" FOREIGN KEY ("replay_id") REFERENCES "public"."replays"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_requests" ADD CONSTRAINT "replay_requests_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_requests" ADD CONSTRAINT "replay_requests_venue_edge_device_id_devices_id_fk" FOREIGN KEY ("venue_edge_device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_requests" ADD CONSTRAINT "replay_requests_camera_device_id_devices_id_fk" FOREIGN KEY ("camera_device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_requests" ADD CONSTRAINT "replay_requests_assignment_id_device_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."device_assignments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_requests" ADD CONSTRAINT "replay_requests_device_command_id_device_commands_id_fk" FOREIGN KEY ("device_command_id") REFERENCES "public"."device_commands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "replay_requests_tenant_id_unique" ON "replay_requests" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "replay_requests_requester_session_idempotency_unique" ON "replay_requests" USING btree ("tenant_id","requester_user_id","play_session_id","client_idempotency_key");--> statement-breakpoint
CREATE INDEX "replay_requests_tenant_id_idx" ON "replay_requests" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "replay_requests_play_session_id_idx" ON "replay_requests" USING btree ("play_session_id");--> statement-breakpoint
CREATE INDEX "replay_requests_replay_id_idx" ON "replay_requests" USING btree ("replay_id");--> statement-breakpoint
CREATE INDEX "replay_requests_status_idx" ON "replay_requests" USING btree ("status");--> statement-breakpoint
ALTER TABLE "replay_requests" ADD CONSTRAINT "replay_requests_tenant_location_fk" FOREIGN KEY ("tenant_id","location_id") REFERENCES "public"."locations"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "replay_requests" ADD CONSTRAINT "replay_requests_tenant_resource_fk" FOREIGN KEY ("tenant_id","resource_id") REFERENCES "public"."resources"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "replay_requests" ADD CONSTRAINT "replay_requests_tenant_play_session_fk" FOREIGN KEY ("tenant_id","play_session_id") REFERENCES "public"."play_sessions"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "replay_requests" ADD CONSTRAINT "replay_requests_tenant_booking_fk" FOREIGN KEY ("tenant_id","booking_id") REFERENCES "public"."bookings"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "replay_requests" ADD CONSTRAINT "replay_requests_tenant_media_asset_fk" FOREIGN KEY ("tenant_id","media_asset_id") REFERENCES "public"."media_assets"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "replay_requests" ADD CONSTRAINT "replay_requests_tenant_venue_edge_device_fk" FOREIGN KEY ("tenant_id","venue_edge_device_id") REFERENCES "public"."devices"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "replay_requests" ADD CONSTRAINT "replay_requests_tenant_camera_device_fk" FOREIGN KEY ("tenant_id","camera_device_id") REFERENCES "public"."devices"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "replay_requests" ADD CONSTRAINT "replay_requests_tenant_assignment_fk" FOREIGN KEY ("tenant_id","assignment_id") REFERENCES "public"."device_assignments"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "replay_requests" ADD CONSTRAINT "replay_requests_tenant_device_command_fk" FOREIGN KEY ("tenant_id","device_command_id") REFERENCES "public"."device_commands"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "replay_requests" VALIDATE CONSTRAINT "replay_requests_tenant_location_fk";--> statement-breakpoint
ALTER TABLE "replay_requests" VALIDATE CONSTRAINT "replay_requests_tenant_resource_fk";--> statement-breakpoint
ALTER TABLE "replay_requests" VALIDATE CONSTRAINT "replay_requests_tenant_play_session_fk";--> statement-breakpoint
ALTER TABLE "replay_requests" VALIDATE CONSTRAINT "replay_requests_tenant_booking_fk";--> statement-breakpoint
ALTER TABLE "replay_requests" VALIDATE CONSTRAINT "replay_requests_tenant_media_asset_fk";--> statement-breakpoint
ALTER TABLE "replay_requests" VALIDATE CONSTRAINT "replay_requests_tenant_venue_edge_device_fk";--> statement-breakpoint
ALTER TABLE "replay_requests" VALIDATE CONSTRAINT "replay_requests_tenant_camera_device_fk";--> statement-breakpoint
ALTER TABLE "replay_requests" VALIDATE CONSTRAINT "replay_requests_tenant_assignment_fk";--> statement-breakpoint
ALTER TABLE "replay_requests" VALIDATE CONSTRAINT "replay_requests_tenant_device_command_fk";
