CREATE TYPE "public"."push_device_platform" AS ENUM('ios', 'android');--> statement-breakpoint
CREATE TYPE "public"."push_device_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."relay_channel_purpose" AS ENUM('lighting', 'hvac', 'display', 'reset', 'other');--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"template_key" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "push_device_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"installation_id" text NOT NULL,
	"platform" "push_device_platform" NOT NULL,
	"encrypted_token" text NOT NULL,
	"encryption_key_version" text NOT NULL,
	"token_fingerprint" text NOT NULL,
	"status" "push_device_status" DEFAULT 'active' NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_delivered_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_device_tokens_failure_count_nonnegative" CHECK ("push_device_tokens"."failure_count" >= 0)
);--> statement-breakpoint
CREATE TABLE "relay_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"assignment_id" uuid,
	"channel_key" text NOT NULL,
	"output_number" integer NOT NULL,
	"purpose" "relay_channel_purpose" NOT NULL,
	"active_state" boolean DEFAULT true NOT NULL,
	"safe_state" boolean DEFAULT false NOT NULL,
	"warning_pattern" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "relay_channels_output_nonnegative" CHECK ("relay_channels"."output_number" >= 0)
);--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "deduplication_key" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "max_attempts" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "next_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "lease_owner" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "leased_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "last_error_code" text;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_user_channel_template_unique" ON "notification_preferences" USING btree ("tenant_id","user_id","channel","template_key");--> statement-breakpoint
CREATE INDEX "notification_preferences_tenant_user_idx" ON "notification_preferences" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "push_device_tokens_tenant_id_unique" ON "push_device_tokens" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "push_device_tokens_installation_unique" ON "push_device_tokens" USING btree ("tenant_id","user_id","installation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "push_device_tokens_fingerprint_unique" ON "push_device_tokens" USING btree ("tenant_id","token_fingerprint");--> statement-breakpoint
CREATE INDEX "push_device_tokens_tenant_user_status_idx" ON "push_device_tokens" USING btree ("tenant_id","user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "relay_channels_tenant_id_unique" ON "relay_channels" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "relay_channels_device_output_unique" ON "relay_channels" USING btree ("tenant_id","device_id","output_number");--> statement-breakpoint
CREATE UNIQUE INDEX "relay_channels_resource_key_unique" ON "relay_channels" USING btree ("tenant_id","resource_id","channel_key");--> statement-breakpoint
CREATE INDEX "relay_channels_location_active_idx" ON "relay_channels" USING btree ("tenant_id","location_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_tenant_deduplication_unique" ON "notifications" USING btree ("tenant_id","user_id","channel","template_key","deduplication_key") WHERE "notifications"."deduplication_key" is not null;--> statement-breakpoint
CREATE INDEX "notifications_delivery_retry_idx" ON "notifications" USING btree ("status","next_attempt_at");--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_device_tokens" ADD CONSTRAINT "push_device_tokens_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_device_tokens" ADD CONSTRAINT "push_device_tokens_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relay_channels" ADD CONSTRAINT "relay_channels_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relay_channels" ADD CONSTRAINT "relay_channels_tenant_location_fk" FOREIGN KEY ("tenant_id","location_id") REFERENCES "public"."locations"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relay_channels" ADD CONSTRAINT "relay_channels_tenant_resource_fk" FOREIGN KEY ("tenant_id","resource_id") REFERENCES "public"."resources"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relay_channels" ADD CONSTRAINT "relay_channels_tenant_device_fk" FOREIGN KEY ("tenant_id","device_id") REFERENCES "public"."devices"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relay_channels" ADD CONSTRAINT "relay_channels_tenant_assignment_fk" FOREIGN KEY ("tenant_id","assignment_id") REFERENCES "public"."device_assignments"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_attempts_valid" CHECK ("notifications"."attempt_count" >= 0 and "notifications"."max_attempts" > 0 and "notifications"."attempt_count" <= "notifications"."max_attempts");
