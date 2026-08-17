CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"metadata" jsonb,
	"correlation_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"key" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"scope" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "access_credentials" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "booking_credit_balances" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "booking_credit_ledger" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "booking_modifications" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "booking_status_history" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "coach_insights" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "coach_subscriptions" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "coach_training_items" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "hardware_configs" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "product_payments" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "replay_credit_balances" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "replay_credit_ledger" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "replays" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "session_events" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_tenant_created_idx" ON "audit_logs" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_tenant_id_idx" ON "audit_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "feature_flags_tenant_key_unique" ON "feature_flags" USING btree ("tenant_id","key");--> statement-breakpoint
CREATE INDEX "feature_flags_tenant_id_idx" ON "feature_flags" USING btree ("tenant_id");--> statement-breakpoint
ALTER TABLE "access_credentials" ADD CONSTRAINT "access_credentials_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_credit_balances" ADD CONSTRAINT "booking_credit_balances_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_credit_ledger" ADD CONSTRAINT "booking_credit_ledger_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_modifications" ADD CONSTRAINT "booking_modifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_insights" ADD CONSTRAINT "coach_insights_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_subscriptions" ADD CONSTRAINT "coach_subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_training_items" ADD CONSTRAINT "coach_training_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_configs" ADD CONSTRAINT "hardware_configs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_payments" ADD CONSTRAINT "product_payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_credit_balances" ADD CONSTRAINT "replay_credit_balances_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_credit_ledger" ADD CONSTRAINT "replay_credit_ledger_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replays" ADD CONSTRAINT "replays_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_events" ADD CONSTRAINT "session_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "access_credentials_tenant_id_idx" ON "access_credentials" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "booking_credit_balances_tenant_id_idx" ON "booking_credit_balances" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "booking_credit_ledger_tenant_id_idx" ON "booking_credit_ledger" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "booking_modifications_tenant_id_idx" ON "booking_modifications" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "booking_status_history_tenant_id_idx" ON "booking_status_history" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "bookings_tenant_id_idx" ON "bookings" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_tenant_id_unique" ON "bookings" USING btree ("tenant_id","id") WHERE "bookings"."tenant_id" is not null;--> statement-breakpoint
CREATE INDEX "coach_insights_tenant_id_idx" ON "coach_insights" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "coach_subscriptions_tenant_id_idx" ON "coach_subscriptions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "coach_training_items_tenant_id_idx" ON "coach_training_items" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "hardware_configs_tenant_id_idx" ON "hardware_configs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "matches_tenant_id_idx" ON "matches" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "notifications_tenant_id_idx" ON "notifications" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "payments_tenant_id_idx" ON "payments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "product_payments_tenant_id_idx" ON "product_payments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "replay_credit_balances_tenant_id_idx" ON "replay_credit_balances" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "replay_credit_ledger_tenant_id_idx" ON "replay_credit_ledger" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "replays_tenant_id_idx" ON "replays" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "session_events_tenant_id_idx" ON "session_events" USING btree ("tenant_id");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tenant_location_fk" FOREIGN KEY ("tenant_id","location_id") REFERENCES "public"."locations"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tenant_resource_fk" FOREIGN KEY ("tenant_id","resource_id") REFERENCES "public"."resources"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_booking_fk" FOREIGN KEY ("tenant_id","booking_id") REFERENCES "public"."bookings"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "booking_modifications" ADD CONSTRAINT "booking_modifications_tenant_booking_fk" FOREIGN KEY ("tenant_id","booking_id") REFERENCES "public"."bookings"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_tenant_booking_fk" FOREIGN KEY ("tenant_id","booking_id") REFERENCES "public"."bookings"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "access_credentials" ADD CONSTRAINT "access_credentials_tenant_booking_fk" FOREIGN KEY ("tenant_id","booking_id") REFERENCES "public"."bookings"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "session_events" ADD CONSTRAINT "session_events_tenant_booking_fk" FOREIGN KEY ("tenant_id","booking_id") REFERENCES "public"."bookings"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_tenant_booking_fk" FOREIGN KEY ("tenant_id","booking_id") REFERENCES "public"."bookings"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "replays" ADD CONSTRAINT "replays_tenant_booking_fk" FOREIGN KEY ("tenant_id","booking_id") REFERENCES "public"."bookings"("tenant_id","id") NOT VALID;--> statement-breakpoint
ALTER TABLE "hardware_configs" ADD CONSTRAINT "hardware_configs_tenant_location_fk" FOREIGN KEY ("tenant_id","location_id") REFERENCES "public"."locations"("tenant_id","id") NOT VALID;