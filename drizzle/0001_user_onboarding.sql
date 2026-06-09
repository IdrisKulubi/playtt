ALTER TABLE "user" ADD COLUMN "onboarding_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "referral_source" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "play_intent" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "early_adopter_opt_in" boolean DEFAULT false NOT NULL;
