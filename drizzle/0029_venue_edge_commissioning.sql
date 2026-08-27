ALTER TABLE "venue_edge_installations" ADD COLUMN "commissioned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "venue_edge_installations" ADD COLUMN "commissioning_snapshot_json" jsonb;
