CREATE TYPE "public"."payment_webhook_inbox_status" AS ENUM('received', 'processing', 'processed', 'failed', 'dead_letter');--> statement-breakpoint
CREATE TABLE "payment_webhook_inbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"provider" "payment_provider" DEFAULT 'paystack' NOT NULL,
	"provider_event_id" text,
	"payload_hash" text NOT NULL,
	"signature" text NOT NULL,
	"event_type" text NOT NULL,
	"raw_payload" text NOT NULL,
	"status" "payment_webhook_inbox_status" DEFAULT 'received' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_webhook_inbox" ADD CONSTRAINT "payment_webhook_inbox_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_webhook_inbox_provider_payload_hash_unique" ON "payment_webhook_inbox" USING btree ("provider","payload_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_webhook_inbox_provider_event_unique" ON "payment_webhook_inbox" USING btree ("provider","provider_event_id") WHERE "provider_event_id" is not null;--> statement-breakpoint
CREATE INDEX "payment_webhook_inbox_status_received_idx" ON "payment_webhook_inbox" USING btree ("status","received_at");--> statement-breakpoint
CREATE INDEX "payment_webhook_inbox_provider_event_idx" ON "payment_webhook_inbox" USING btree ("provider","provider_event_id");
