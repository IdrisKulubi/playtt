CREATE TYPE "public"."booking_modification_status" AS ENUM('pending_payment', 'applied', 'cancelled');--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "group_size" integer;--> statement-breakpoint
UPDATE "bookings"
SET "group_size" = COALESCE(
  NULLIF(("pricing_rule_snapshot"->>'groupSize')::text, '')::integer,
  CASE
    WHEN "notes" ~ 'Group size: [0-9]+' THEN (regexp_match("notes", 'Group size: ([0-9]+)'))[1]::integer
    ELSE 2
  END
);--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "group_size" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_group_size_range" CHECK ("group_size" >= 2 AND "group_size" <= 8);--> statement-breakpoint
CREATE TABLE "booking_modifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"status" "booking_modification_status" DEFAULT 'pending_payment' NOT NULL,
	"change_type" text NOT NULL,
	"before_snapshot" jsonb NOT NULL,
	"after_snapshot" jsonb NOT NULL,
	"delta_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'KES' NOT NULL,
	"payment_id" uuid,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "booking_modifications" ADD CONSTRAINT "booking_modifications_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_modifications" ADD CONSTRAINT "booking_modifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_modifications" ADD CONSTRAINT "booking_modifications_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_modifications_booking_idx" ON "booking_modifications" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_modifications_status_idx" ON "booking_modifications" USING btree ("status");
