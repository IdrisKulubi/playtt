CREATE TYPE "public"."device_command_status" AS ENUM('pending', 'delivered', 'acknowledged', 'failed', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."device_command_kind" AS ENUM('apply_config', 'reset', 'reboot');--> statement-breakpoint
CREATE TABLE "device_heartbeats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"device_id" uuid NOT NULL,
	"boot_id" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"firmware_version" text,
	"uptime_ms" integer,
	"wifi_rssi" integer,
	"free_heap_bytes" integer,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"correlation_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"device_id" uuid NOT NULL,
	"kind" "device_command_kind" NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "device_command_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"correlation_id" text NOT NULL,
	"causation_id" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"delivered_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"result" jsonb,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_command_acks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"command_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"success" boolean NOT NULL,
	"result" jsonb,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "device_heartbeats" ADD CONSTRAINT "device_heartbeats_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_heartbeats" ADD CONSTRAINT "device_heartbeats_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_command_acks" ADD CONSTRAINT "device_command_acks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_command_acks" ADD CONSTRAINT "device_command_acks_command_id_device_commands_id_fk" FOREIGN KEY ("command_id") REFERENCES "public"."device_commands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_command_acks" ADD CONSTRAINT "device_command_acks_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "device_heartbeats_tenant_id_unique" ON "device_heartbeats" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "device_heartbeats_tenant_id_idx" ON "device_heartbeats" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "device_heartbeats_device_observed_idx" ON "device_heartbeats" USING btree ("device_id","observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "device_commands_tenant_id_unique" ON "device_commands" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "device_commands_tenant_id_idx" ON "device_commands" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "device_commands_device_status_idx" ON "device_commands" USING btree ("device_id","status","expires_at");--> statement-breakpoint
CREATE INDEX "device_commands_expires_at_idx" ON "device_commands" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "device_command_acks_command_idempotency_unique" ON "device_command_acks" USING btree ("command_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "device_command_acks_tenant_id_unique" ON "device_command_acks" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "device_command_acks_tenant_id_idx" ON "device_command_acks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "device_command_acks_command_id_idx" ON "device_command_acks" USING btree ("command_id");--> statement-breakpoint
ALTER TABLE "device_heartbeats" ADD CONSTRAINT "device_heartbeats_tenant_device_fk" FOREIGN KEY ("tenant_id","device_id") REFERENCES "public"."devices"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_tenant_device_fk" FOREIGN KEY ("tenant_id","device_id") REFERENCES "public"."devices"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "device_command_acks" ADD CONSTRAINT "device_command_acks_tenant_command_fk" FOREIGN KEY ("tenant_id","command_id") REFERENCES "public"."device_commands"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "device_command_acks" ADD CONSTRAINT "device_command_acks_tenant_device_fk" FOREIGN KEY ("tenant_id","device_id") REFERENCES "public"."devices"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "device_heartbeats" VALIDATE CONSTRAINT "device_heartbeats_tenant_device_fk";--> statement-breakpoint
ALTER TABLE "device_commands" VALIDATE CONSTRAINT "device_commands_tenant_device_fk";--> statement-breakpoint
ALTER TABLE "device_command_acks" VALIDATE CONSTRAINT "device_command_acks_tenant_command_fk";--> statement-breakpoint
ALTER TABLE "device_command_acks" VALIDATE CONSTRAINT "device_command_acks_tenant_device_fk";
