ALTER TABLE "replays" ADD COLUMN IF NOT EXISTS "favorited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "replays" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
