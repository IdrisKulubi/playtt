CREATE TYPE "public"."media_kind" AS ENUM('source_video', 'preview_image', 'derived_video');--> statement-breakpoint
CREATE TYPE "public"."media_status" AS ENUM('pending_upload', 'uploaded', 'ready', 'failed', 'deletion_pending', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."media_retention_class" AS ENUM('session_short', 'replay_standard', 'replay_owned');--> statement-breakpoint
CREATE TYPE "public"."media_event_inbox_status" AS ENUM('received', 'processing', 'processed', 'failed', 'dead_letter');--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"location_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"play_session_id" uuid NOT NULL,
	"owner_user_id" text NOT NULL,
	"object_key" text NOT NULL,
	"kind" "media_kind" NOT NULL,
	"content_type" text,
	"size_bytes" integer,
	"checksum_sha256" text,
	"expected_content_type" text NOT NULL,
	"expected_max_bytes" integer NOT NULL,
	"status" "media_status" DEFAULT 'pending_upload' NOT NULL,
	"retention_class" "media_retention_class" DEFAULT 'replay_standard' NOT NULL,
	"uploaded_at" timestamp with time zone,
	"ready_at" timestamp with time zone,
	"deletion_requested_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_event_inbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"media_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload_hash" text NOT NULL,
	"raw_payload" text NOT NULL,
	"status" "media_event_inbox_status" DEFAULT 'received' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_expires_at" timestamp with time zone,
	"lease_owner" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "replays" ADD COLUMN "media_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_play_session_id_play_sessions_id_fk" FOREIGN KEY ("play_session_id") REFERENCES "public"."play_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_event_inbox" ADD CONSTRAINT "media_event_inbox_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_event_inbox" ADD CONSTRAINT "media_event_inbox_media_id_media_assets_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replays" ADD CONSTRAINT "replays_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_object_key_unique" ON "media_assets" USING btree ("object_key");--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_tenant_id_unique" ON "media_assets" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "media_assets_tenant_id_idx" ON "media_assets" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "media_assets_play_session_id_idx" ON "media_assets" USING btree ("play_session_id");--> statement-breakpoint
CREATE INDEX "media_assets_owner_user_id_idx" ON "media_assets" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "media_assets_status_idx" ON "media_assets" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "media_event_inbox_media_event_payload_unique" ON "media_event_inbox" USING btree ("media_id","event_type","payload_hash");--> statement-breakpoint
CREATE INDEX "media_event_inbox_status_received_idx" ON "media_event_inbox" USING btree ("status","received_at");--> statement-breakpoint
CREATE INDEX "media_event_inbox_claim_idx" ON "media_event_inbox" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX "media_event_inbox_media_id_idx" ON "media_event_inbox" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "replays_media_asset_id_idx" ON "replays" USING btree ("media_asset_id");--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_tenant_location_fk" FOREIGN KEY ("tenant_id","location_id") REFERENCES "public"."locations"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_tenant_resource_fk" FOREIGN KEY ("tenant_id","resource_id") REFERENCES "public"."resources"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_tenant_play_session_fk" FOREIGN KEY ("tenant_id","play_session_id") REFERENCES "public"."play_sessions"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "media_event_inbox" ADD CONSTRAINT "media_event_inbox_tenant_media_fk" FOREIGN KEY ("tenant_id","media_id") REFERENCES "public"."media_assets"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "replays" ADD CONSTRAINT "replays_tenant_media_asset_fk" FOREIGN KEY ("tenant_id","media_asset_id") REFERENCES "public"."media_assets"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "media_assets" VALIDATE CONSTRAINT "media_assets_tenant_location_fk";--> statement-breakpoint
ALTER TABLE "media_assets" VALIDATE CONSTRAINT "media_assets_tenant_resource_fk";--> statement-breakpoint
ALTER TABLE "media_assets" VALIDATE CONSTRAINT "media_assets_tenant_play_session_fk";--> statement-breakpoint
ALTER TABLE "media_event_inbox" VALIDATE CONSTRAINT "media_event_inbox_tenant_media_fk";--> statement-breakpoint
ALTER TABLE "replays" VALIDATE CONSTRAINT "replays_tenant_media_asset_fk";
