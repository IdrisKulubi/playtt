CREATE TYPE "public"."ttlock_connection_status" AS ENUM('pending', 'active', 'reauth_required', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."ttlock_inventory_status" AS ENUM('unknown', 'online', 'offline', 'unsupported', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."ttlock_unlock_event_kind" AS ENUM('passcode_unlock', 'remote_unlock', 'invalid_passcode', 'tamper', 'gateway', 'other');--> statement-breakpoint
CREATE TABLE "ttlock_access_point_locks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"access_point_id" uuid NOT NULL,
	"lock_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"commissioned_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ttlock_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"api_base_url" text NOT NULL,
	"client_id" text NOT NULL,
	"encrypted_client_secret" text NOT NULL,
	"client_secret_key_version" text NOT NULL,
	"encrypted_access_token" text,
	"access_token_key_version" text,
	"encrypted_refresh_token" text,
	"refresh_token_key_version" text,
	"access_token_expires_at" timestamp with time zone,
	"status" "ttlock_connection_status" DEFAULT 'pending' NOT NULL,
	"refresh_lease_owner" text,
	"refresh_leased_until" timestamp with time zone,
	"last_sync_at" timestamp with time zone,
	"last_error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ttlock_connections_access_token_key_pair" CHECK (("ttlock_connections"."encrypted_access_token" is null) = ("ttlock_connections"."access_token_key_version" is null)),
	CONSTRAINT "ttlock_connections_refresh_token_key_pair" CHECK (("ttlock_connections"."encrypted_refresh_token" is null) = ("ttlock_connections"."refresh_token_key_version" is null))
);
--> statement-breakpoint
CREATE TABLE "ttlock_gateways" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"device_id" uuid,
	"external_gateway_id" text NOT NULL,
	"name" text,
	"status" "ttlock_inventory_status" DEFAULT 'unknown' NOT NULL,
	"firmware_version" text,
	"lock_count" integer,
	"last_seen_at" timestamp with time zone,
	"last_sync_at" timestamp with time zone NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ttlock_locks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"gateway_id" uuid,
	"device_id" uuid,
	"external_lock_id" text NOT NULL,
	"name" text,
	"status" "ttlock_inventory_status" DEFAULT 'unknown' NOT NULL,
	"passcode_version" integer,
	"supports_custom_passcodes" boolean DEFAULT false NOT NULL,
	"gateway_online" boolean DEFAULT false NOT NULL,
	"battery_percent" integer,
	"clock_offset_ms" integer,
	"firmware_version" text,
	"last_seen_at" timestamp with time zone,
	"last_sync_at" timestamp with time zone NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ttlock_locks_battery_range" CHECK ("ttlock_locks"."battery_percent" is null or ("ttlock_locks"."battery_percent" >= 0 and "ttlock_locks"."battery_percent" <= 100))
);
--> statement-breakpoint
CREATE TABLE "ttlock_unlock_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"lock_id" uuid NOT NULL,
	"access_credential_id" uuid,
	"external_record_id" text NOT NULL,
	"kind" "ttlock_unlock_event_kind" NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"redacted_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ttlock_venue_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ttlock_access_point_locks" ADD CONSTRAINT "ttlock_access_point_locks_tenant_point_fk" FOREIGN KEY ("tenant_id","access_point_id") REFERENCES "public"."access_points"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ttlock_access_point_locks" ADD CONSTRAINT "ttlock_access_point_locks_tenant_lock_fk" FOREIGN KEY ("tenant_id","lock_id") REFERENCES "public"."ttlock_locks"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ttlock_access_point_locks" ADD CONSTRAINT "ttlock_access_point_locks_tenant_connection_fk" FOREIGN KEY ("tenant_id","connection_id") REFERENCES "public"."ttlock_connections"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ttlock_connections" ADD CONSTRAINT "ttlock_connections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ttlock_gateways" ADD CONSTRAINT "ttlock_gateways_tenant_connection_fk" FOREIGN KEY ("tenant_id","connection_id") REFERENCES "public"."ttlock_connections"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ttlock_gateways" ADD CONSTRAINT "ttlock_gateways_tenant_device_fk" FOREIGN KEY ("tenant_id","device_id") REFERENCES "public"."devices"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ttlock_locks" ADD CONSTRAINT "ttlock_locks_tenant_connection_fk" FOREIGN KEY ("tenant_id","connection_id") REFERENCES "public"."ttlock_connections"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ttlock_locks" ADD CONSTRAINT "ttlock_locks_tenant_gateway_fk" FOREIGN KEY ("tenant_id","gateway_id") REFERENCES "public"."ttlock_gateways"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ttlock_locks" ADD CONSTRAINT "ttlock_locks_tenant_device_fk" FOREIGN KEY ("tenant_id","device_id") REFERENCES "public"."devices"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ttlock_unlock_records" ADD CONSTRAINT "ttlock_unlock_records_tenant_connection_fk" FOREIGN KEY ("tenant_id","connection_id") REFERENCES "public"."ttlock_connections"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ttlock_unlock_records" ADD CONSTRAINT "ttlock_unlock_records_tenant_lock_fk" FOREIGN KEY ("tenant_id","lock_id") REFERENCES "public"."ttlock_locks"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ttlock_unlock_records" ADD CONSTRAINT "ttlock_unlock_records_tenant_credential_fk" FOREIGN KEY ("tenant_id","access_credential_id") REFERENCES "public"."access_credentials"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ttlock_venue_connections" ADD CONSTRAINT "ttlock_venue_connections_tenant_location_fk" FOREIGN KEY ("tenant_id","location_id") REFERENCES "public"."locations"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ttlock_venue_connections" ADD CONSTRAINT "ttlock_venue_connections_tenant_connection_fk" FOREIGN KEY ("tenant_id","connection_id") REFERENCES "public"."ttlock_connections"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ttlock_access_point_locks_active_point_unique" ON "ttlock_access_point_locks" USING btree ("tenant_id","access_point_id") WHERE "ttlock_access_point_locks"."is_active";--> statement-breakpoint
CREATE UNIQUE INDEX "ttlock_access_point_locks_active_lock_unique" ON "ttlock_access_point_locks" USING btree ("tenant_id","lock_id") WHERE "ttlock_access_point_locks"."is_active";--> statement-breakpoint
CREATE INDEX "ttlock_access_point_locks_connection_idx" ON "ttlock_access_point_locks" USING btree ("connection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ttlock_connections_tenant_id_unique" ON "ttlock_connections" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "ttlock_connections_tenant_name_unique" ON "ttlock_connections" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "ttlock_connections_tenant_status_idx" ON "ttlock_connections" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "ttlock_gateways_tenant_id_unique" ON "ttlock_gateways" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "ttlock_gateways_connection_external_unique" ON "ttlock_gateways" USING btree ("connection_id","external_gateway_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ttlock_gateways_tenant_device_unique" ON "ttlock_gateways" USING btree ("tenant_id","device_id");--> statement-breakpoint
CREATE INDEX "ttlock_gateways_tenant_status_idx" ON "ttlock_gateways" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "ttlock_locks_tenant_id_unique" ON "ttlock_locks" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "ttlock_locks_connection_external_unique" ON "ttlock_locks" USING btree ("connection_id","external_lock_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ttlock_locks_tenant_device_unique" ON "ttlock_locks" USING btree ("tenant_id","device_id");--> statement-breakpoint
CREATE INDEX "ttlock_locks_tenant_status_idx" ON "ttlock_locks" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "ttlock_locks_gateway_idx" ON "ttlock_locks" USING btree ("gateway_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ttlock_unlock_records_connection_external_unique" ON "ttlock_unlock_records" USING btree ("connection_id","external_record_id");--> statement-breakpoint
CREATE INDEX "ttlock_unlock_records_tenant_occurred_idx" ON "ttlock_unlock_records" USING btree ("tenant_id","occurred_at");--> statement-breakpoint
CREATE INDEX "ttlock_unlock_records_lock_occurred_idx" ON "ttlock_unlock_records" USING btree ("lock_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ttlock_venue_connections_location_connection_unique" ON "ttlock_venue_connections" USING btree ("tenant_id","location_id","connection_id");--> statement-breakpoint
CREATE INDEX "ttlock_venue_connections_tenant_idx" ON "ttlock_venue_connections" USING btree ("tenant_id");--> statement-breakpoint
ALTER TABLE "access_credentials" ADD CONSTRAINT "access_credentials_tenant_connection_fk" FOREIGN KEY ("tenant_id","connection_id") REFERENCES "public"."ttlock_connections"("tenant_id","id") ON DELETE restrict ON UPDATE no action;
