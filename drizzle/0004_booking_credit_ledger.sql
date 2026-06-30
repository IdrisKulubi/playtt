CREATE TABLE "booking_credit_balances" (
	"user_id" text PRIMARY KEY NOT NULL,
	"balance_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'KES' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "booking_credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"booking_id" uuid,
	"booking_modification_id" uuid,
	"delta_amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'KES' NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "booking_credit_balances" ADD CONSTRAINT "booking_credit_balances_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_credit_ledger" ADD CONSTRAINT "booking_credit_ledger_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_credit_ledger" ADD CONSTRAINT "booking_credit_ledger_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_credit_ledger" ADD CONSTRAINT "booking_credit_ledger_booking_modification_id_booking_modifications_id_fk" FOREIGN KEY ("booking_modification_id") REFERENCES "public"."booking_modifications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_credit_ledger_user_created_idx" ON "booking_credit_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "booking_credit_ledger_booking_idx" ON "booking_credit_ledger" USING btree ("booking_id");
