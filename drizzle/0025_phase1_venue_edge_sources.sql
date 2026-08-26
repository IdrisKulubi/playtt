CREATE TYPE "public"."replay_capture_attempt_status" AS ENUM('pending', 'capturing', 'succeeded', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."replay_source_capture_mode" AS ENUM('edge_buffer', 'nvr_playback');--> statement-breakpoint
CREATE TYPE "public"."replay_source_health_status" AS ENUM('unknown', 'healthy', 'degraded', 'offline', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."replay_source_selection_mode" AS ENUM('automatic', 'manual');--> statement-breakpoint
CREATE TYPE "public"."venue_edge_config_application_status" AS ENUM('pending', 'applied', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."venue_edge_config_revision_status" AS ENUM('draft', 'published', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."venue_edge_secret_ref_status" AS ENUM('active', 'reauth_required', 'revoked');--> statement-breakpoint
CREATE TABLE "replay_camera_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"location_id" uuid NOT NULL,
	"recorder_id" uuid NOT NULL,
	"camera_device_id" uuid,
	"channel_key" text NOT NULL,
	"stream_profile" text DEFAULT 'main' NOT NULL,
	"label" text NOT NULL,
	"live_stream_path" text,
	"playback_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"capabilities" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "replay_camera_sources_live_path_relative" CHECK ("replay_camera_sources"."live_stream_path" is null or position('://' in "replay_camera_sources"."live_stream_path") = 0)
);--> statement-breakpoint
CREATE TABLE "replay_capture_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"location_id" uuid NOT NULL,
	"replay_request_id" uuid NOT NULL,
	"config_revision_id" uuid,
	"source_route_id" uuid NOT NULL,
	"camera_source_id" uuid NOT NULL,
	"recorder_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"capture_mode" "replay_source_capture_mode" NOT NULL,
	"status" "replay_capture_attempt_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failure_reason" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "replay_capture_attempts_ordinal_positive" CHECK ("replay_capture_attempts"."ordinal" > 0),
	CONSTRAINT "replay_capture_attempts_window_valid" CHECK ("replay_capture_attempts"."completed_at" is null or "replay_capture_attempts"."started_at" is null or "replay_capture_attempts"."completed_at" >= "replay_capture_attempts"."started_at")
);--> statement-breakpoint
CREATE TABLE "replay_recorders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"location_id" uuid NOT NULL,
	"label" text NOT NULL,
	"vendor" text NOT NULL,
	"model" text,
	"firmware_version" text,
	"host" text,
	"rtsp_port" integer,
	"playback_port" integer,
	"connection_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "replay_recorders_rtsp_port_valid" CHECK ("replay_recorders"."rtsp_port" is null or ("replay_recorders"."rtsp_port" > 0 and "replay_recorders"."rtsp_port" <= 65535)),
	CONSTRAINT "replay_recorders_playback_port_valid" CHECK ("replay_recorders"."playback_port" is null or ("replay_recorders"."playback_port" > 0 and "replay_recorders"."playback_port" <= 65535)),
	CONSTRAINT "replay_recorders_host_not_credentialized" CHECK ("replay_recorders"."host" is null or position('@' in "replay_recorders"."host") = 0)
);--> statement-breakpoint
CREATE TABLE "replay_source_health" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"location_id" uuid NOT NULL,
	"edge_device_id" uuid NOT NULL,
	"recorder_id" uuid NOT NULL,
	"camera_source_id" uuid,
	"status" "replay_source_health_status" DEFAULT 'unknown' NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"last_frame_at" timestamp with time zone,
	"last_successful_capture_at" timestamp with time zone,
	"latency_ms" integer,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"failure_code" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "replay_source_health_latency_nonnegative" CHECK ("replay_source_health"."latency_ms" is null or "replay_source_health"."latency_ms" >= 0),
	CONSTRAINT "replay_source_health_failures_nonnegative" CHECK ("replay_source_health"."consecutive_failures" >= 0)
);--> statement-breakpoint
CREATE TABLE "replay_source_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"location_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"selection_mode" "replay_source_selection_mode" DEFAULT 'automatic' NOT NULL,
	"manual_source_id" uuid,
	"override_expires_at" timestamp with time zone,
	"override_reason" text,
	"override_actor_id" text,
	"failure_threshold" integer DEFAULT 3 NOT NULL,
	"healthy_threshold" integer DEFAULT 2 NOT NULL,
	"cooldown_seconds" integer DEFAULT 60 NOT NULL,
	"auto_failback" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "replay_source_policies_manual_override_valid" CHECK (("replay_source_policies"."selection_mode" = 'automatic' and "replay_source_policies"."manual_source_id" is null) or ("replay_source_policies"."selection_mode" = 'manual' and "replay_source_policies"."manual_source_id" is not null and coalesce(length("replay_source_policies"."override_reason"), 0) > 0 and coalesce(length("replay_source_policies"."override_actor_id"), 0) > 0)),
	CONSTRAINT "replay_source_policies_thresholds_positive" CHECK ("replay_source_policies"."failure_threshold" > 0 and "replay_source_policies"."healthy_threshold" > 0),
	CONSTRAINT "replay_source_policies_cooldown_nonnegative" CHECK ("replay_source_policies"."cooldown_seconds" >= 0)
);--> statement-breakpoint
CREATE TABLE "replay_source_routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"location_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"camera_source_id" uuid NOT NULL,
	"priority" integer NOT NULL,
	"capture_modes" "replay_source_capture_mode"[] NOT NULL,
	"policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "replay_source_routes_priority_positive" CHECK ("replay_source_routes"."priority" > 0),
	CONSTRAINT "replay_source_routes_capture_modes_nonempty" CHECK (cardinality("replay_source_routes"."capture_modes") > 0)
);--> statement-breakpoint
CREATE TABLE "venue_edge_config_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"location_id" uuid NOT NULL,
	"edge_device_id" uuid NOT NULL,
	"config_revision_id" uuid NOT NULL,
	"status" "venue_edge_config_application_status" DEFAULT 'pending' NOT NULL,
	"boot_id" text,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_at" timestamp with time zone,
	"error_code" text,
	"error_details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "venue_edge_config_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"location_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" "venue_edge_config_revision_status" DEFAULT 'draft' NOT NULL,
	"checksum_sha256" text NOT NULL,
	"snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_actor_id" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venue_edge_config_revisions_version_positive" CHECK ("venue_edge_config_revisions"."version" > 0),
	CONSTRAINT "venue_edge_config_revisions_checksum_present" CHECK (length("venue_edge_config_revisions"."checksum_sha256") > 0)
);--> statement-breakpoint
CREATE TABLE "venue_edge_installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"location_id" uuid NOT NULL,
	"edge_device_id" uuid NOT NULL,
	"installation_uid" uuid NOT NULL,
	"display_name" text NOT NULL,
	"platform" text NOT NULL,
	"architecture" text NOT NULL,
	"current_agent_version" text NOT NULL,
	"desired_agent_version" text,
	"update_channel" text DEFAULT 'stable' NOT NULL,
	"installed_at" timestamp with time zone NOT NULL,
	"last_config_applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "venue_edge_secret_refs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"location_id" uuid NOT NULL,
	"edge_device_id" uuid NOT NULL,
	"recorder_id" uuid NOT NULL,
	"local_key" text NOT NULL,
	"credential_version" integer DEFAULT 1 NOT NULL,
	"username" text,
	"status" "venue_edge_secret_ref_status" DEFAULT 'active' NOT NULL,
	"last_verified_at" timestamp with time zone,
	"rotated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venue_edge_secret_refs_credential_version_positive" CHECK ("venue_edge_secret_refs"."credential_version" > 0)
);--> statement-breakpoint
ALTER TABLE "replay_requests" ADD COLUMN "config_revision_id" uuid;--> statement-breakpoint
ALTER TABLE "replay_requests" ADD COLUMN "selected_camera_source_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "replay_camera_sources_tenant_id_unique" ON "replay_camera_sources" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "replay_camera_sources_tenant_location_id_unique" ON "replay_camera_sources" USING btree ("tenant_id","location_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "replay_camera_sources_location_recorder_id_unique" ON "replay_camera_sources" USING btree ("tenant_id","location_id","recorder_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "replay_camera_sources_channel_profile_unique" ON "replay_camera_sources" USING btree ("tenant_id","recorder_id","channel_key","stream_profile");--> statement-breakpoint
CREATE INDEX "replay_camera_sources_location_enabled_idx" ON "replay_camera_sources" USING btree ("tenant_id","location_id","is_enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "replay_capture_attempts_tenant_id_unique" ON "replay_capture_attempts" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "replay_capture_attempts_request_ordinal_unique" ON "replay_capture_attempts" USING btree ("tenant_id","replay_request_id","ordinal");--> statement-breakpoint
CREATE INDEX "replay_capture_attempts_request_status_idx" ON "replay_capture_attempts" USING btree ("replay_request_id","status");--> statement-breakpoint
CREATE INDEX "replay_capture_attempts_source_created_idx" ON "replay_capture_attempts" USING btree ("camera_source_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "replay_recorders_tenant_id_unique" ON "replay_recorders" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "replay_recorders_tenant_location_id_unique" ON "replay_recorders" USING btree ("tenant_id","location_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "replay_recorders_location_label_unique" ON "replay_recorders" USING btree ("tenant_id","location_id","label");--> statement-breakpoint
CREATE INDEX "replay_recorders_location_enabled_idx" ON "replay_recorders" USING btree ("tenant_id","location_id","is_enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "replay_source_health_tenant_id_unique" ON "replay_source_health" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "replay_source_health_recorder_current_unique" ON "replay_source_health" USING btree ("tenant_id","edge_device_id","recorder_id") WHERE "replay_source_health"."camera_source_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "replay_source_health_camera_current_unique" ON "replay_source_health" USING btree ("tenant_id","edge_device_id","camera_source_id") WHERE "replay_source_health"."camera_source_id" is not null;--> statement-breakpoint
CREATE INDEX "replay_source_health_location_status_idx" ON "replay_source_health" USING btree ("tenant_id","location_id","status","observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "replay_source_policies_tenant_id_unique" ON "replay_source_policies" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "replay_source_policies_resource_unique" ON "replay_source_policies" USING btree ("tenant_id","location_id","resource_id");--> statement-breakpoint
CREATE INDEX "replay_source_policies_location_mode_idx" ON "replay_source_policies" USING btree ("tenant_id","location_id","selection_mode");--> statement-breakpoint
CREATE UNIQUE INDEX "replay_source_routes_tenant_id_unique" ON "replay_source_routes" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "replay_source_routes_tenant_location_id_unique" ON "replay_source_routes" USING btree ("tenant_id","location_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "replay_source_routes_location_id_source_unique" ON "replay_source_routes" USING btree ("tenant_id","location_id","id","camera_source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "replay_source_routes_resource_source_unique" ON "replay_source_routes" USING btree ("tenant_id","location_id","resource_id","camera_source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "replay_source_routes_location_priority_active_unique" ON "replay_source_routes" USING btree ("tenant_id","resource_id","priority") WHERE "replay_source_routes"."is_enabled" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "replay_source_routes_source_active_unique" ON "replay_source_routes" USING btree ("tenant_id","resource_id","camera_source_id") WHERE "replay_source_routes"."is_enabled" = true;--> statement-breakpoint
CREATE INDEX "replay_source_routes_resource_enabled_idx" ON "replay_source_routes" USING btree ("tenant_id","location_id","resource_id","is_enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "venue_edge_config_applications_tenant_id_unique" ON "venue_edge_config_applications" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "venue_edge_config_applications_device_revision_unique" ON "venue_edge_config_applications" USING btree ("tenant_id","edge_device_id","config_revision_id");--> statement-breakpoint
CREATE INDEX "venue_edge_config_applications_device_status_idx" ON "venue_edge_config_applications" USING btree ("edge_device_id","status","attempted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "venue_edge_config_revisions_tenant_id_unique" ON "venue_edge_config_revisions" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "venue_edge_config_revisions_tenant_location_id_unique" ON "venue_edge_config_revisions" USING btree ("tenant_id","location_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "venue_edge_config_revisions_location_version_unique" ON "venue_edge_config_revisions" USING btree ("tenant_id","location_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "venue_edge_config_revisions_location_published_unique" ON "venue_edge_config_revisions" USING btree ("tenant_id","location_id") WHERE "venue_edge_config_revisions"."status" = 'published';--> statement-breakpoint
CREATE INDEX "venue_edge_config_revisions_location_status_idx" ON "venue_edge_config_revisions" USING btree ("tenant_id","location_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "venue_edge_installations_tenant_id_unique" ON "venue_edge_installations" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "venue_edge_installations_tenant_device_unique" ON "venue_edge_installations" USING btree ("tenant_id","edge_device_id");--> statement-breakpoint
CREATE UNIQUE INDEX "venue_edge_installations_tenant_uid_unique" ON "venue_edge_installations" USING btree ("tenant_id","installation_uid");--> statement-breakpoint
CREATE INDEX "venue_edge_installations_location_channel_idx" ON "venue_edge_installations" USING btree ("tenant_id","location_id","update_channel");--> statement-breakpoint
CREATE UNIQUE INDEX "venue_edge_secret_refs_tenant_id_unique" ON "venue_edge_secret_refs" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "venue_edge_secret_refs_device_recorder_version_unique" ON "venue_edge_secret_refs" USING btree ("tenant_id","edge_device_id","recorder_id","credential_version");--> statement-breakpoint
CREATE UNIQUE INDEX "venue_edge_secret_refs_device_recorder_active_unique" ON "venue_edge_secret_refs" USING btree ("tenant_id","edge_device_id","recorder_id") WHERE "venue_edge_secret_refs"."status" = 'active';--> statement-breakpoint
CREATE INDEX "venue_edge_secret_refs_location_status_idx" ON "venue_edge_secret_refs" USING btree ("tenant_id","location_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "devices_tenant_location_id_unique" ON "devices" USING btree ("tenant_id","location_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "replay_requests_tenant_location_id_unique" ON "replay_requests" USING btree ("tenant_id","location_id","id");--> statement-breakpoint
CREATE INDEX "replay_requests_config_revision_id_idx" ON "replay_requests" USING btree ("config_revision_id");--> statement-breakpoint
CREATE INDEX "replay_requests_selected_source_id_idx" ON "replay_requests" USING btree ("selected_camera_source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "resources_tenant_location_id_unique" ON "resources" USING btree ("tenant_id","location_id","id");--> statement-breakpoint
ALTER TABLE "replay_camera_sources" ADD CONSTRAINT "replay_camera_sources_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_camera_sources" ADD CONSTRAINT "replay_camera_sources_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_camera_sources" ADD CONSTRAINT "replay_camera_sources_tenant_location_recorder_fk" FOREIGN KEY ("tenant_id","location_id","recorder_id") REFERENCES "public"."replay_recorders"("tenant_id","location_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_camera_sources" ADD CONSTRAINT "replay_camera_sources_tenant_location_device_fk" FOREIGN KEY ("tenant_id","location_id","camera_device_id") REFERENCES "public"."devices"("tenant_id","location_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_capture_attempts" ADD CONSTRAINT "replay_capture_attempts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_capture_attempts" ADD CONSTRAINT "replay_capture_attempts_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_capture_attempts" ADD CONSTRAINT "replay_capture_attempts_tenant_location_request_fk" FOREIGN KEY ("tenant_id","location_id","replay_request_id") REFERENCES "public"."replay_requests"("tenant_id","location_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_capture_attempts" ADD CONSTRAINT "replay_capture_attempts_tenant_location_revision_fk" FOREIGN KEY ("tenant_id","location_id","config_revision_id") REFERENCES "public"."venue_edge_config_revisions"("tenant_id","location_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_capture_attempts" ADD CONSTRAINT "replay_capture_attempts_tenant_location_route_source_fk" FOREIGN KEY ("tenant_id","location_id","source_route_id","camera_source_id") REFERENCES "public"."replay_source_routes"("tenant_id","location_id","id","camera_source_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_capture_attempts" ADD CONSTRAINT "replay_capture_attempts_tenant_location_recorder_source_fk" FOREIGN KEY ("tenant_id","location_id","recorder_id","camera_source_id") REFERENCES "public"."replay_camera_sources"("tenant_id","location_id","recorder_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_recorders" ADD CONSTRAINT "replay_recorders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_recorders" ADD CONSTRAINT "replay_recorders_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_recorders" ADD CONSTRAINT "replay_recorders_tenant_location_fk" FOREIGN KEY ("tenant_id","location_id") REFERENCES "public"."locations"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_source_health" ADD CONSTRAINT "replay_source_health_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_source_health" ADD CONSTRAINT "replay_source_health_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_source_health" ADD CONSTRAINT "replay_source_health_tenant_location_device_fk" FOREIGN KEY ("tenant_id","location_id","edge_device_id") REFERENCES "public"."devices"("tenant_id","location_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_source_health" ADD CONSTRAINT "replay_source_health_tenant_location_recorder_fk" FOREIGN KEY ("tenant_id","location_id","recorder_id") REFERENCES "public"."replay_recorders"("tenant_id","location_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_source_health" ADD CONSTRAINT "replay_source_health_tenant_location_recorder_source_fk" FOREIGN KEY ("tenant_id","location_id","recorder_id","camera_source_id") REFERENCES "public"."replay_camera_sources"("tenant_id","location_id","recorder_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_source_policies" ADD CONSTRAINT "replay_source_policies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_source_policies" ADD CONSTRAINT "replay_source_policies_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_source_policies" ADD CONSTRAINT "replay_source_policies_tenant_location_resource_fk" FOREIGN KEY ("tenant_id","location_id","resource_id") REFERENCES "public"."resources"("tenant_id","location_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_source_policies" ADD CONSTRAINT "replay_source_policies_tenant_location_manual_route_fk" FOREIGN KEY ("tenant_id","location_id","resource_id","manual_source_id") REFERENCES "public"."replay_source_routes"("tenant_id","location_id","resource_id","camera_source_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_source_routes" ADD CONSTRAINT "replay_source_routes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_source_routes" ADD CONSTRAINT "replay_source_routes_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_source_routes" ADD CONSTRAINT "replay_source_routes_tenant_location_fk" FOREIGN KEY ("tenant_id","location_id") REFERENCES "public"."locations"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_source_routes" ADD CONSTRAINT "replay_source_routes_tenant_location_resource_fk" FOREIGN KEY ("tenant_id","location_id","resource_id") REFERENCES "public"."resources"("tenant_id","location_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_source_routes" ADD CONSTRAINT "replay_source_routes_tenant_location_source_fk" FOREIGN KEY ("tenant_id","location_id","camera_source_id") REFERENCES "public"."replay_camera_sources"("tenant_id","location_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_edge_config_applications" ADD CONSTRAINT "venue_edge_config_applications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_edge_config_applications" ADD CONSTRAINT "venue_edge_config_applications_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_edge_config_applications" ADD CONSTRAINT "venue_edge_config_applications_tenant_location_device_fk" FOREIGN KEY ("tenant_id","location_id","edge_device_id") REFERENCES "public"."devices"("tenant_id","location_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_edge_config_applications" ADD CONSTRAINT "venue_edge_config_applications_tenant_location_revision_fk" FOREIGN KEY ("tenant_id","location_id","config_revision_id") REFERENCES "public"."venue_edge_config_revisions"("tenant_id","location_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_edge_config_revisions" ADD CONSTRAINT "venue_edge_config_revisions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_edge_config_revisions" ADD CONSTRAINT "venue_edge_config_revisions_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_edge_config_revisions" ADD CONSTRAINT "venue_edge_config_revisions_tenant_location_fk" FOREIGN KEY ("tenant_id","location_id") REFERENCES "public"."locations"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_edge_installations" ADD CONSTRAINT "venue_edge_installations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_edge_installations" ADD CONSTRAINT "venue_edge_installations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_edge_installations" ADD CONSTRAINT "venue_edge_installations_tenant_location_device_fk" FOREIGN KEY ("tenant_id","location_id","edge_device_id") REFERENCES "public"."devices"("tenant_id","location_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_edge_secret_refs" ADD CONSTRAINT "venue_edge_secret_refs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_edge_secret_refs" ADD CONSTRAINT "venue_edge_secret_refs_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_edge_secret_refs" ADD CONSTRAINT "venue_edge_secret_refs_tenant_location_device_fk" FOREIGN KEY ("tenant_id","location_id","edge_device_id") REFERENCES "public"."devices"("tenant_id","location_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_edge_secret_refs" ADD CONSTRAINT "venue_edge_secret_refs_tenant_location_recorder_fk" FOREIGN KEY ("tenant_id","location_id","recorder_id") REFERENCES "public"."replay_recorders"("tenant_id","location_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_requests" ADD CONSTRAINT "replay_requests_tenant_location_config_revision_fk" FOREIGN KEY ("tenant_id","location_id","config_revision_id") REFERENCES "public"."venue_edge_config_revisions"("tenant_id","location_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_requests" ADD CONSTRAINT "replay_requests_tenant_location_selected_source_fk" FOREIGN KEY ("tenant_id","location_id","selected_camera_source_id") REFERENCES "public"."replay_camera_sources"("tenant_id","location_id","id") ON DELETE restrict ON UPDATE no action;
