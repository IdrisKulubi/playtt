CREATE TYPE "public"."venue_edge_pairing_session_status" AS ENUM('waiting_for_install', 'cancelled', 'expired', 'consumed');--> statement-breakpoint
CREATE TABLE "venue_edge_pairing_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"location_id" uuid NOT NULL,
	"status" "venue_edge_pairing_session_status" DEFAULT 'waiting_for_install' NOT NULL,
	"code_hash" text NOT NULL,
	"code_hint" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"cancelled_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"created_by_actor_id" text NOT NULL,
	"replace_installation_id" uuid,
	"correlation_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "venue_edge_pairing_rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"subject_hash" text NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venue_edge_pairing_rate_limits_count_non_negative" CHECK ("venue_edge_pairing_rate_limits"."count" >= 0)
);--> statement-breakpoint
ALTER TABLE "venue_edge_pairing_sessions" ADD CONSTRAINT "venue_edge_pairing_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_edge_pairing_sessions" ADD CONSTRAINT "venue_edge_pairing_sessions_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_edge_pairing_sessions" ADD CONSTRAINT "venue_edge_pairing_sessions_tenant_location_fk" FOREIGN KEY ("tenant_id","location_id") REFERENCES "public"."locations"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_edge_pairing_sessions" ADD CONSTRAINT "venue_edge_pairing_sessions_replace_installation_fk" FOREIGN KEY ("tenant_id","replace_installation_id") REFERENCES "public"."venue_edge_installations"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "venue_edge_pairing_sessions_tenant_id_unique" ON "venue_edge_pairing_sessions" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "venue_edge_pairing_sessions_tenant_code_hash_unique" ON "venue_edge_pairing_sessions" USING btree ("tenant_id","code_hash");--> statement-breakpoint
CREATE INDEX "venue_edge_pairing_sessions_location_status_idx" ON "venue_edge_pairing_sessions" USING btree ("tenant_id","location_id","status");--> statement-breakpoint
CREATE INDEX "venue_edge_pairing_sessions_expires_at_idx" ON "venue_edge_pairing_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "venue_edge_pairing_rate_limits_scope_subject_window_unique" ON "venue_edge_pairing_rate_limits" USING btree ("scope","subject_hash","window_started_at");--> statement-breakpoint
CREATE INDEX "venue_edge_pairing_rate_limits_scope_subject_idx" ON "venue_edge_pairing_rate_limits" USING btree ("scope","subject_hash");
