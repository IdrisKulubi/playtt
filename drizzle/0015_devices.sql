CREATE TYPE "public"."device_type" AS ENUM('esp32_controller', 'ttlock_lock', 'ttlock_gateway');--> statement-breakpoint
CREATE TYPE "public"."device_status" AS ENUM('pending', 'active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."device_credential_status" AS ENUM('active', 'rotated', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."device_assignment_role" AS ENUM('score_input', 'lock', 'gateway', 'display');--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"location_id" uuid NOT NULL,
	"type" "device_type" NOT NULL,
	"hardware_uid" text NOT NULL,
	"firmware_version" text,
	"status" "device_status" DEFAULT 'pending' NOT NULL,
	"capability_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_seen_at" timestamp with time zone,
	"last_heartbeat_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"location_id" uuid NOT NULL,
	"device_type" "device_type" NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"consumed_device_id" uuid,
	"correlation_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"device_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"secret_hash" text NOT NULL,
	"status" "device_credential_status" DEFAULT 'active' NOT NULL,
	"rotated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"device_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"resource_id" uuid,
	"role" "device_assignment_role" NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"config_version" integer DEFAULT 1 NOT NULL,
	"applied_config_version" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_enrollments" ADD CONSTRAINT "device_enrollments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_enrollments" ADD CONSTRAINT "device_enrollments_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_enrollments" ADD CONSTRAINT "device_enrollments_consumed_device_id_devices_id_fk" FOREIGN KEY ("consumed_device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_credentials" ADD CONSTRAINT "device_credentials_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_credentials" ADD CONSTRAINT "device_credentials_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_assignments" ADD CONSTRAINT "device_assignments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_assignments" ADD CONSTRAINT "device_assignments_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_assignments" ADD CONSTRAINT "device_assignments_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_assignments" ADD CONSTRAINT "device_assignments_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "devices_tenant_id_unique" ON "devices" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "devices_tenant_hardware_uid_unique" ON "devices" USING btree ("tenant_id","hardware_uid");--> statement-breakpoint
CREATE INDEX "devices_tenant_id_idx" ON "devices" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "devices_location_id_idx" ON "devices" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "devices_status_idx" ON "devices" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "device_enrollments_tenant_code_hash_unique" ON "device_enrollments" USING btree ("tenant_id","code_hash");--> statement-breakpoint
CREATE INDEX "device_enrollments_tenant_id_idx" ON "device_enrollments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "device_enrollments_location_id_idx" ON "device_enrollments" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "device_enrollments_expires_at_idx" ON "device_enrollments" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "device_credentials_device_version_unique" ON "device_credentials" USING btree ("device_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "device_credentials_active_unique" ON "device_credentials" USING btree ("device_id") WHERE "status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "device_credentials_tenant_id_unique" ON "device_credentials" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "device_credentials_tenant_id_idx" ON "device_credentials" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "device_credentials_device_id_idx" ON "device_credentials" USING btree ("device_id");--> statement-breakpoint
CREATE UNIQUE INDEX "device_assignments_device_open_unique" ON "device_assignments" USING btree ("tenant_id","device_id") WHERE "effective_to" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "device_assignments_scoring_resource_role_open_unique" ON "device_assignments" USING btree ("tenant_id","resource_id","role") WHERE "role" = 'score_input' and "resource_id" is not null and "effective_to" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "device_assignments_tenant_id_unique" ON "device_assignments" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "device_assignments_tenant_id_idx" ON "device_assignments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "device_assignments_device_id_idx" ON "device_assignments" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "device_assignments_resource_id_idx" ON "device_assignments" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "device_assignments_effective_window_idx" ON "device_assignments" USING btree ("device_id","effective_from","effective_to");--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_tenant_location_fk" FOREIGN KEY ("tenant_id","location_id") REFERENCES "public"."locations"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "device_enrollments" ADD CONSTRAINT "device_enrollments_tenant_location_fk" FOREIGN KEY ("tenant_id","location_id") REFERENCES "public"."locations"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "device_credentials" ADD CONSTRAINT "device_credentials_tenant_device_fk" FOREIGN KEY ("tenant_id","device_id") REFERENCES "public"."devices"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "device_assignments" ADD CONSTRAINT "device_assignments_tenant_device_fk" FOREIGN KEY ("tenant_id","device_id") REFERENCES "public"."devices"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "device_assignments" ADD CONSTRAINT "device_assignments_tenant_location_fk" FOREIGN KEY ("tenant_id","location_id") REFERENCES "public"."locations"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "device_assignments" ADD CONSTRAINT "device_assignments_tenant_resource_fk" FOREIGN KEY ("tenant_id","resource_id") REFERENCES "public"."resources"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "device_assignments" ADD CONSTRAINT "device_assignments_effective_window" CHECK ("effective_to" is null or "effective_to" > "effective_from");--> statement-breakpoint
ALTER TABLE "devices" VALIDATE CONSTRAINT "devices_tenant_location_fk";--> statement-breakpoint
ALTER TABLE "device_enrollments" VALIDATE CONSTRAINT "device_enrollments_tenant_location_fk";--> statement-breakpoint
ALTER TABLE "device_credentials" VALIDATE CONSTRAINT "device_credentials_tenant_device_fk";--> statement-breakpoint
ALTER TABLE "device_assignments" VALIDATE CONSTRAINT "device_assignments_tenant_device_fk";--> statement-breakpoint
ALTER TABLE "device_assignments" VALIDATE CONSTRAINT "device_assignments_tenant_location_fk";--> statement-breakpoint
ALTER TABLE "device_assignments" VALIDATE CONSTRAINT "device_assignments_tenant_resource_fk";
