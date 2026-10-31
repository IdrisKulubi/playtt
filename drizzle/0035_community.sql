CREATE TYPE "public"."community_handedness" AS ENUM('right', 'left');--> statement-breakpoint
CREATE TYPE "public"."community_play_style" AS ENUM('attacker', 'defender', 'all_round');--> statement-breakpoint
CREATE TYPE "public"."community_report_reason" AS ENUM('spam', 'harassment', 'inappropriate', 'no_show', 'other');--> statement-breakpoint
CREATE TYPE "public"."community_report_status" AS ENUM('open', 'reviewed', 'actioned');--> statement-breakpoint
CREATE TYPE "public"."community_request_policy" AS ENUM('everyone', 'followers', 'rally_partners');--> statement-breakpoint
CREATE TYPE "public"."play_availability_window" AS ENUM('now', 'today', 'tonight', 'weekend');--> statement-breakpoint
CREATE TABLE "community_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"reporter_id" text NOT NULL,
	"target_user_id" text NOT NULL,
	"message_id" uuid,
	"reason" "community_report_reason" NOT NULL,
	"note" text,
	"status" "community_report_status" DEFAULT 'open' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "community_reports_note_length" CHECK ("community_reports"."note" is null or char_length("community_reports"."note") <= 500)
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"follower_id" text NOT NULL,
	"followee_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follows_not_self" CHECK ("follows"."follower_id" <> "follows"."followee_id")
);
--> statement-breakpoint
CREATE TABLE "play_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"user_id" text NOT NULL,
	"location_id" uuid NOT NULL,
	"window" "play_availability_window" NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"note" text,
	"looking_for_doubles" boolean DEFAULT false NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "play_availability_window_valid" CHECK ("play_availability"."ends_at" > "play_availability"."starts_at"),
	CONSTRAINT "play_availability_note_length" CHECK ("play_availability"."note" is null or char_length("play_availability"."note") <= 80)
);
--> statement-breakpoint
CREATE TABLE "player_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"community_visible" boolean DEFAULT false NOT NULL,
	"bio" text,
	"play_style" "community_play_style",
	"handedness" "community_handedness",
	"usual_times" text[] DEFAULT '{}'::text[] NOT NULL,
	"request_policy" "community_request_policy" DEFAULT 'everyone' NOT NULL,
	"show_at_venue" boolean DEFAULT false NOT NULL,
	"founding_player" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_profiles_bio_length" CHECK ("player_profiles"."bio" is null or char_length("player_profiles"."bio") <= 140)
);
--> statement-breakpoint
CREATE TABLE "user_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"blocker_id" text NOT NULL,
	"blocked_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_blocks_not_self" CHECK ("user_blocks"."blocker_id" <> "user_blocks"."blocked_id")
);
--> statement-breakpoint
ALTER TABLE "community_reports" ADD CONSTRAINT "community_reports_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_reports" ADD CONSTRAINT "community_reports_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_reports" ADD CONSTRAINT "community_reports_target_user_id_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_reports" ADD CONSTRAINT "community_reports_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_user_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_followee_id_user_id_fk" FOREIGN KEY ("followee_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_availability" ADD CONSTRAINT "play_availability_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_availability" ADD CONSTRAINT "play_availability_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_availability" ADD CONSTRAINT "play_availability_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_profiles" ADD CONSTRAINT "player_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_profiles" ADD CONSTRAINT "player_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_id_user_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_id_user_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "community_reports_status_created_idx" ON "community_reports" USING btree ("tenant_id","status","created_at");--> statement-breakpoint
CREATE INDEX "community_reports_target_idx" ON "community_reports" USING btree ("target_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "follows_follower_followee_unique" ON "follows" USING btree ("follower_id","followee_id");--> statement-breakpoint
CREATE INDEX "follows_followee_idx" ON "follows" USING btree ("followee_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "play_availability_user_active_unique" ON "play_availability" USING btree ("user_id") WHERE "play_availability"."ended_at" is null;--> statement-breakpoint
CREATE INDEX "play_availability_location_ends_idx" ON "play_availability" USING btree ("tenant_id","location_id","ends_at");--> statement-breakpoint
CREATE INDEX "player_profiles_tenant_visible_idx" ON "player_profiles" USING btree ("tenant_id","community_visible");--> statement-breakpoint
CREATE UNIQUE INDEX "user_blocks_blocker_blocked_unique" ON "user_blocks" USING btree ("blocker_id","blocked_id");--> statement-breakpoint
CREATE INDEX "user_blocks_blocked_idx" ON "user_blocks" USING btree ("blocked_id");