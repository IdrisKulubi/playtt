CREATE TABLE "venue_edge_installer_releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"version" text NOT NULL,
	"channel" text DEFAULT 'pilot' NOT NULL,
	"platform" text DEFAULT 'windows' NOT NULL,
	"architecture" text DEFAULT 'x64' NOT NULL,
	"object_key" text NOT NULL,
	"file_name" text NOT NULL,
	"sha256" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"is_signed" boolean DEFAULT false NOT NULL,
	"signature_publisher" text,
	"minimum_windows_version" text DEFAULT '10 22H2' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"release_notes" text,
	"published_at" timestamp with time zone,
	"withdrawn_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venue_edge_installer_releases_channel_valid" CHECK ("venue_edge_installer_releases"."channel" in ('pilot', 'stable')),
	CONSTRAINT "venue_edge_installer_releases_status_valid" CHECK ("venue_edge_installer_releases"."status" in ('draft', 'published', 'withdrawn')),
	CONSTRAINT "venue_edge_installer_releases_artifact_valid" CHECK (length("venue_edge_installer_releases"."object_key") > 0 and length("venue_edge_installer_releases"."file_name") > 0 and "venue_edge_installer_releases"."sha256" ~ '^[0-9a-fA-F]{64}$' and "venue_edge_installer_releases"."size_bytes" > 0),
	CONSTRAINT "venue_edge_installer_releases_stable_signed" CHECK ("venue_edge_installer_releases"."channel" <> 'stable' or "venue_edge_installer_releases"."is_signed" = true),
	CONSTRAINT "venue_edge_installer_releases_signature_consistent" CHECK ("venue_edge_installer_releases"."is_signed" = false or length(coalesce("venue_edge_installer_releases"."signature_publisher", '')) > 0),
	CONSTRAINT "venue_edge_installer_releases_publication_consistent" CHECK (("venue_edge_installer_releases"."status" <> 'published' or "venue_edge_installer_releases"."published_at" is not null) and ("venue_edge_installer_releases"."status" <> 'withdrawn' or "venue_edge_installer_releases"."withdrawn_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "venue_edge_installer_pilot_eligibility" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"release_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"granted_by_user_id" text,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "venue_edge_installer_pilot_eligibility_window_valid" CHECK ("venue_edge_installer_pilot_eligibility"."expires_at" is null or "venue_edge_installer_pilot_eligibility"."expires_at" > "venue_edge_installer_pilot_eligibility"."granted_at")
);
--> statement-breakpoint
CREATE TABLE "venue_edge_installer_download_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"release_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"requested_by_user_id" text,
	"outcome" text NOT NULL,
	"reason_code" text,
	"correlation_id" text NOT NULL,
	"download_url_expires_at" timestamp with time zone,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venue_edge_installer_download_audits_outcome_valid" CHECK ("venue_edge_installer_download_audits"."outcome" in ('allowed', 'denied')),
	CONSTRAINT "venue_edge_installer_download_audits_result_consistent" CHECK (("venue_edge_installer_download_audits"."outcome" = 'allowed' and "venue_edge_installer_download_audits"."download_url_expires_at" is not null) or ("venue_edge_installer_download_audits"."outcome" = 'denied' and length(coalesce("venue_edge_installer_download_audits"."reason_code", '')) > 0))
);
--> statement-breakpoint
CREATE FUNCTION "prevent_venue_edge_installer_artifact_mutation"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF OLD."status" IN ('published', 'withdrawn') AND (
		NEW."tenant_id" IS DISTINCT FROM OLD."tenant_id" OR
		NEW."version" IS DISTINCT FROM OLD."version" OR
		NEW."channel" IS DISTINCT FROM OLD."channel" OR
		NEW."platform" IS DISTINCT FROM OLD."platform" OR
		NEW."architecture" IS DISTINCT FROM OLD."architecture" OR
		NEW."object_key" IS DISTINCT FROM OLD."object_key" OR
		NEW."file_name" IS DISTINCT FROM OLD."file_name" OR
		NEW."sha256" IS DISTINCT FROM OLD."sha256" OR
		NEW."size_bytes" IS DISTINCT FROM OLD."size_bytes" OR
		NEW."is_signed" IS DISTINCT FROM OLD."is_signed" OR
		NEW."signature_publisher" IS DISTINCT FROM OLD."signature_publisher" OR
		NEW."minimum_windows_version" IS DISTINCT FROM OLD."minimum_windows_version"
	) THEN
		RAISE EXCEPTION 'Published VenueEdge installer artifact metadata is immutable.';
	END IF;

	RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "venue_edge_installer_artifact_immutable"
BEFORE UPDATE ON "venue_edge_installer_releases"
FOR EACH ROW EXECUTE FUNCTION "prevent_venue_edge_installer_artifact_mutation"();
--> statement-breakpoint
CREATE UNIQUE INDEX "venue_edge_installer_releases_tenant_id_unique" ON "venue_edge_installer_releases" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "venue_edge_installer_releases_object_key_unique" ON "venue_edge_installer_releases" USING btree ("tenant_id","object_key");--> statement-breakpoint
CREATE UNIQUE INDEX "venue_edge_installer_releases_version_channel_unique" ON "venue_edge_installer_releases" USING btree ("tenant_id","version","channel","platform","architecture");--> statement-breakpoint
CREATE INDEX "venue_edge_installer_releases_channel_status_idx" ON "venue_edge_installer_releases" USING btree ("tenant_id","channel","status","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "venue_edge_installer_pilot_eligibility_unique" ON "venue_edge_installer_pilot_eligibility" USING btree ("tenant_id","release_id","location_id");--> statement-breakpoint
CREATE INDEX "venue_edge_installer_pilot_location_idx" ON "venue_edge_installer_pilot_eligibility" USING btree ("tenant_id","location_id","revoked_at","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "venue_edge_installer_download_audits_correlation_unique" ON "venue_edge_installer_download_audits" USING btree ("tenant_id","correlation_id");--> statement-breakpoint
CREATE INDEX "venue_edge_installer_download_audits_location_idx" ON "venue_edge_installer_download_audits" USING btree ("tenant_id","location_id","requested_at");--> statement-breakpoint
CREATE INDEX "venue_edge_installer_download_audits_release_idx" ON "venue_edge_installer_download_audits" USING btree ("tenant_id","release_id","requested_at");--> statement-breakpoint
ALTER TABLE "venue_edge_installer_releases" ADD CONSTRAINT "venue_edge_installer_releases_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_edge_installer_pilot_eligibility" ADD CONSTRAINT "venue_edge_installer_pilot_eligibility_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_edge_installer_pilot_eligibility" ADD CONSTRAINT "venue_edge_installer_pilot_eligibility_granted_by_user_id_user_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_edge_installer_pilot_eligibility" ADD CONSTRAINT "venue_edge_installer_pilot_release_fk" FOREIGN KEY ("tenant_id","release_id") REFERENCES "public"."venue_edge_installer_releases"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_edge_installer_pilot_eligibility" ADD CONSTRAINT "venue_edge_installer_pilot_location_fk" FOREIGN KEY ("tenant_id","location_id") REFERENCES "public"."locations"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_edge_installer_download_audits" ADD CONSTRAINT "venue_edge_installer_download_audits_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_edge_installer_download_audits" ADD CONSTRAINT "venue_edge_installer_download_audits_requested_by_user_id_user_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_edge_installer_download_audits" ADD CONSTRAINT "venue_edge_installer_download_audits_release_fk" FOREIGN KEY ("tenant_id","release_id") REFERENCES "public"."venue_edge_installer_releases"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_edge_installer_download_audits" ADD CONSTRAINT "venue_edge_installer_download_audits_location_fk" FOREIGN KEY ("tenant_id","location_id") REFERENCES "public"."locations"("tenant_id","id") ON DELETE restrict ON UPDATE no action;
