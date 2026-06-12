CREATE TYPE "public"."product_type" AS ENUM('replay_pack', 'coach_subscription');--> statement-breakpoint
CREATE TYPE "public"."coach_subscription_status" AS ENUM('active', 'past_due', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."replay_credit_ledger_reason" AS ENUM('pack_purchase', 'replay_capture', 'admin_adjust', 'refund');--> statement-breakpoint
CREATE TABLE "replay_credit_balances" (
	"user_id" text PRIMARY KEY NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "product_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"product_type" "product_type" NOT NULL,
	"provider" "payment_provider" DEFAULT 'paystack' NOT NULL,
	"provider_reference" text NOT NULL,
	"provider_event_id" text,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'KES' NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp with time zone,
	"raw_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_payments_amount_positive" CHECK ("product_payments"."amount" > 0)
);--> statement-breakpoint
CREATE TABLE "replay_credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"delta" integer NOT NULL,
	"reason" "replay_credit_ledger_reason" NOT NULL,
	"booking_id" uuid,
	"replay_id" uuid,
	"product_payment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "coach_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"status" "coach_subscription_status" DEFAULT 'active' NOT NULL,
	"plan_id" text DEFAULT 'coach_monthly' NOT NULL,
	"paystack_subscription_code" text,
	"current_period_end" timestamp with time zone NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "coach_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"replay_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"focus_areas" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "coach_training_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"insight_id" uuid,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"duration_minutes" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "replay_credit_balances" ADD CONSTRAINT "replay_credit_balances_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_payments" ADD CONSTRAINT "product_payments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_credit_ledger" ADD CONSTRAINT "replay_credit_ledger_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_credit_ledger" ADD CONSTRAINT "replay_credit_ledger_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_credit_ledger" ADD CONSTRAINT "replay_credit_ledger_replay_id_replays_id_fk" FOREIGN KEY ("replay_id") REFERENCES "public"."replays"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_credit_ledger" ADD CONSTRAINT "replay_credit_ledger_product_payment_id_product_payments_id_fk" FOREIGN KEY ("product_payment_id") REFERENCES "public"."product_payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_subscriptions" ADD CONSTRAINT "coach_subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_insights" ADD CONSTRAINT "coach_insights_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_insights" ADD CONSTRAINT "coach_insights_replay_id_replays_id_fk" FOREIGN KEY ("replay_id") REFERENCES "public"."replays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_insights" ADD CONSTRAINT "coach_insights_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_training_items" ADD CONSTRAINT "coach_training_items_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_training_items" ADD CONSTRAINT "coach_training_items_insight_id_coach_insights_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."coach_insights"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_payments_provider_reference_unique" ON "product_payments" USING btree ("provider","provider_reference");--> statement-breakpoint
CREATE INDEX "product_payments_user_created_idx" ON "product_payments" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "replay_credit_ledger_user_created_idx" ON "replay_credit_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "coach_subscriptions_user_unique" ON "coach_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "coach_subscriptions_status_idx" ON "coach_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "coach_insights_user_created_idx" ON "coach_insights" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "coach_insights_replay_unique" ON "coach_insights" USING btree ("replay_id");--> statement-breakpoint
CREATE INDEX "coach_training_items_user_sort_idx" ON "coach_training_items" USING btree ("user_id","sort_order");
