CREATE TABLE "display_themes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"name" text NOT NULL,
	"renderer" text NOT NULL,
	"palette" jsonb NOT NULL,
	"ink" text DEFAULT 'dark' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "display_themes_renderer_allowed" CHECK ("display_themes"."renderer" in ('liquid_glass', 'silk', 'rally_ripples')),
	CONSTRAINT "display_themes_ink_allowed" CHECK ("display_themes"."ink" in ('light', 'dark'))
);
--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "display_theme_key" text;--> statement-breakpoint
ALTER TABLE "display_themes" ADD CONSTRAINT "display_themes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "display_themes_tenant_id_idx" ON "display_themes" USING btree ("tenant_id");