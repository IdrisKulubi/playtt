CREATE TYPE "public"."match_side" AS ENUM('a', 'b');--> statement-breakpoint
CREATE TABLE "community_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"code" text NOT NULL,
	"inviter_id" text NOT NULL,
	"accepted_by" text,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_rated_matches" (
	"match_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"delta_a" integer NOT NULL,
	"delta_b" integer NOT NULL,
	"rated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"match_id" uuid NOT NULL,
	"side" "match_side" NOT NULL,
	"user_id" text NOT NULL,
	"assigned_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_ratings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"rating" integer DEFAULT 1000 NOT NULL,
	"rated_matches" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "community_conversations" ADD COLUMN "availability_id" uuid;--> statement-breakpoint
ALTER TABLE "community_conversations" ADD COLUMN "max_members" integer;--> statement-breakpoint
ALTER TABLE "community_conversations" ADD COLUMN "starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "community_conversations" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "community_conversations" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "community_invites" ADD CONSTRAINT "community_invites_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_invites" ADD CONSTRAINT "community_invites_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_invites" ADD CONSTRAINT "community_invites_accepted_by_user_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_rated_matches" ADD CONSTRAINT "community_rated_matches_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_rated_matches" ADD CONSTRAINT "community_rated_matches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_assigned_by_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_ratings" ADD CONSTRAINT "player_ratings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_ratings" ADD CONSTRAINT "player_ratings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "community_invites_code_unique" ON "community_invites" USING btree ("code");--> statement-breakpoint
CREATE INDEX "community_invites_inviter_created_idx" ON "community_invites" USING btree ("inviter_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "match_players_match_side_unique" ON "match_players" USING btree ("match_id","side");--> statement-breakpoint
CREATE UNIQUE INDEX "match_players_match_user_unique" ON "match_players" USING btree ("match_id","user_id");--> statement-breakpoint
CREATE INDEX "match_players_user_idx" ON "match_players" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "community_conversations" ADD CONSTRAINT "community_conversations_availability_id_play_availability_id_fk" FOREIGN KEY ("availability_id") REFERENCES "public"."play_availability"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "community_conversations_availability_unique" ON "community_conversations" USING btree ("availability_id");--> statement-breakpoint
CREATE INDEX "community_conversations_type_starts_idx" ON "community_conversations" USING btree ("tenant_id","type","starts_at");