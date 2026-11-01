CREATE TYPE "public"."community_kudos_type" AS ENUM('great_rallies', 'fair_play', 'on_time', 'fun_to_play', 'great_serve', 'good_coach');--> statement-breakpoint
CREATE TABLE "community_booking_partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"booking_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "session_participant_role" NOT NULL,
	"conversation_id" uuid,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "community_kudos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"booking_id" uuid NOT NULL,
	"giver_id" text NOT NULL,
	"receiver_id" text NOT NULL,
	"type" "community_kudos_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "community_kudos_not_self" CHECK ("community_kudos"."giver_id" <> "community_kudos"."receiver_id")
);
--> statement-breakpoint
CREATE TABLE "community_reliability_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"booking_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"reason" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "player_profiles" ADD COLUMN "muted_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "community_booking_partners" ADD CONSTRAINT "community_booking_partners_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_booking_partners" ADD CONSTRAINT "community_booking_partners_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_booking_partners" ADD CONSTRAINT "community_booking_partners_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_booking_partners" ADD CONSTRAINT "community_booking_partners_conversation_id_community_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."community_conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_kudos" ADD CONSTRAINT "community_kudos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_kudos" ADD CONSTRAINT "community_kudos_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_kudos" ADD CONSTRAINT "community_kudos_giver_id_user_id_fk" FOREIGN KEY ("giver_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_kudos" ADD CONSTRAINT "community_kudos_receiver_id_user_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_reliability_overrides" ADD CONSTRAINT "community_reliability_overrides_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_reliability_overrides" ADD CONSTRAINT "community_reliability_overrides_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_reliability_overrides" ADD CONSTRAINT "community_reliability_overrides_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_reliability_overrides" ADD CONSTRAINT "community_reliability_overrides_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "community_booking_partners_booking_user_unique" ON "community_booking_partners" USING btree ("booking_id","user_id");--> statement-breakpoint
CREATE INDEX "community_booking_partners_user_idx" ON "community_booking_partners" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "community_kudos_unique" ON "community_kudos" USING btree ("booking_id","giver_id","receiver_id","type");--> statement-breakpoint
CREATE INDEX "community_kudos_receiver_idx" ON "community_kudos" USING btree ("receiver_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "community_reliability_overrides_unique" ON "community_reliability_overrides" USING btree ("booking_id","user_id");