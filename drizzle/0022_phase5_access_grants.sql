CREATE TYPE "public"."access_grant_status" AS ENUM('configuring', 'ready', 'temporarily_unavailable', 'action_required', 'revoking', 'revoked', 'expired', 'failed');--> statement-breakpoint
ALTER TYPE "public"."access_credential_status" ADD VALUE 'provisioning' BEFORE 'active';--> statement-breakpoint
ALTER TYPE "public"."access_credential_status" ADD VALUE 'modifying' BEFORE 'expired';--> statement-breakpoint
ALTER TYPE "public"."access_credential_status" ADD VALUE 'retrying' BEFORE 'expired';--> statement-breakpoint
ALTER TYPE "public"."access_credential_status" ADD VALUE 'revoking' BEFORE 'expired';--> statement-breakpoint
ALTER TYPE "public"."device_assignment_role" ADD VALUE 'relay_controller';--> statement-breakpoint
ALTER TYPE "public"."device_command_kind" ADD VALUE 'set_output';--> statement-breakpoint
CREATE TABLE "access_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"booking_id" uuid NOT NULL,
	"play_session_id" uuid,
	"owner_user_id" text NOT NULL,
	"location_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"encrypted_code" text NOT NULL,
	"encryption_key_version" text NOT NULL,
	"code_fingerprint" text NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"status" "access_grant_status" DEFAULT 'configuring' NOT NULL,
	"correlation_id" text NOT NULL,
	"reveal_ready_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "access_grants_valid_window" CHECK ("access_grants"."valid_until" > "access_grants"."valid_from")
);
--> statement-breakpoint
DROP INDEX "access_credentials_external_reference_idx";--> statement-breakpoint
ALTER TABLE "access_credentials" ADD COLUMN "grant_id" uuid;--> statement-breakpoint
ALTER TABLE "access_credentials" ADD COLUMN "access_point_id" uuid;--> statement-breakpoint
ALTER TABLE "access_credentials" ADD COLUMN "lock_device_id" uuid;--> statement-breakpoint
ALTER TABLE "access_credentials" ADD COLUMN "connection_id" uuid;--> statement-breakpoint
ALTER TABLE "access_credentials" ADD COLUMN "stable_name" text;--> statement-breakpoint
ALTER TABLE "access_credentials" ADD COLUMN "attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "access_credentials" ADD COLUMN "max_attempts" integer DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE "access_credentials" ADD COLUMN "next_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "access_credentials" ADD COLUMN "lease_owner" text;--> statement-breakpoint
ALTER TABLE "access_credentials" ADD COLUMN "leased_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "access_credentials" ADD COLUMN "provider_error_category" text;--> statement-breakpoint
ALTER TABLE "access_credentials" ADD COLUMN "provider_error_code" text;--> statement-breakpoint
ALTER TABLE "access_credentials" ADD COLUMN "provisioned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "access_credentials" ADD COLUMN "revoke_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "access_credentials" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "access_credentials" ADD COLUMN "reconciled_at" timestamp with time zone;--> statement-breakpoint
INSERT INTO "access_grants" (
	"tenant_id", "booking_id", "play_session_id", "owner_user_id", "location_id", "resource_id",
	"encrypted_code", "encryption_key_version", "code_fingerprint", "valid_from", "valid_until",
	"status", "correlation_id", "failed_at"
)
SELECT
	ac."tenant_id", ac."booking_id", min(ac."play_session_id"::text)::uuid, b."user_id", b."location_id", b."resource_id",
	'legacy-credential-unavailable', 'legacy', 'legacy:' || ac."booking_id"::text,
	min(ac."valid_from"), max(ac."valid_until"), 'action_required',
	'phase5-legacy:' || ac."booking_id"::text, now()
FROM "access_credentials" ac
JOIN "bookings" b ON b."tenant_id" = ac."tenant_id" AND b."id" = ac."booking_id"
GROUP BY ac."tenant_id", ac."booking_id", b."user_id", b."location_id", b."resource_id";--> statement-breakpoint
UPDATE "access_credentials" ac
SET
	"grant_id" = ag."id",
	"access_point_id" = point."id",
	"lock_device_id" = lock_assignment."device_id",
	"stable_name" = 'playtt:' || ag."id"::text || ':' || ac."id"::text,
	"status" = 'failed',
	"provider_error_category" = 'configuration_terminal',
	"provider_error_code" = 'LEGACY_CREDENTIAL_REQUIRES_REPROVISION'
FROM "access_grants" ag
LEFT JOIN LATERAL (
	SELECT ap."id"
	FROM "access_point_resources" apr
	JOIN "access_points" ap ON ap."tenant_id" = apr."tenant_id" AND ap."id" = apr."access_point_id"
	WHERE apr."tenant_id" = ag."tenant_id" AND apr."resource_id" = ag."resource_id" AND ap."is_active"
	ORDER BY apr."sort_order", ap."sort_order", ap."id"
	LIMIT 1
) point ON true
LEFT JOIN LATERAL (
	SELECT da."device_id"
	FROM "device_assignments" da
	WHERE da."tenant_id" = ag."tenant_id" AND da."location_id" = ag."location_id"
		AND da."role" = 'lock' AND da."effective_to" IS NULL
		AND (da."resource_id" = ag."resource_id" OR da."resource_id" IS NULL)
	ORDER BY (da."resource_id" IS NOT NULL) DESC, da."effective_from" DESC, da."id"
	LIMIT 1
) lock_assignment ON true
WHERE ag."tenant_id" = ac."tenant_id" AND ag."booking_id" = ac."booking_id";--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM "access_credentials"
		WHERE "grant_id" IS NULL OR "access_point_id" IS NULL OR "lock_device_id" IS NULL OR "stable_name" IS NULL
	) THEN
		RAISE EXCEPTION 'Phase 5 migration cannot map one or more legacy access credentials to an active access point and lock device. Revoke/delete preview credentials or commission mappings before retrying.';
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "access_credentials" ALTER COLUMN "grant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "access_credentials" ALTER COLUMN "access_point_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "access_credentials" ALTER COLUMN "lock_device_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "access_credentials" ALTER COLUMN "stable_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_tenant_booking_fk" FOREIGN KEY ("tenant_id","booking_id") REFERENCES "public"."bookings"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_tenant_session_fk" FOREIGN KEY ("tenant_id","play_session_id") REFERENCES "public"."play_sessions"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_tenant_location_fk" FOREIGN KEY ("tenant_id","location_id") REFERENCES "public"."locations"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_tenant_resource_fk" FOREIGN KEY ("tenant_id","resource_id") REFERENCES "public"."resources"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "access_grants_tenant_id_unique" ON "access_grants" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "access_grants_active_booking_unique" ON "access_grants" USING btree ("tenant_id","booking_id") WHERE "access_grants"."status" not in ('revoked', 'expired', 'failed');--> statement-breakpoint
CREATE INDEX "access_grants_tenant_status_idx" ON "access_grants" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "access_grants_booking_idx" ON "access_grants" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "access_grants_session_idx" ON "access_grants" USING btree ("play_session_id");--> statement-breakpoint
CREATE INDEX "access_grants_valid_until_idx" ON "access_grants" USING btree ("valid_until");--> statement-breakpoint
ALTER TABLE "access_credentials" ADD CONSTRAINT "access_credentials_grant_id_access_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."access_grants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_credentials" ADD CONSTRAINT "access_credentials_access_point_id_access_points_id_fk" FOREIGN KEY ("access_point_id") REFERENCES "public"."access_points"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_credentials" ADD CONSTRAINT "access_credentials_lock_device_id_devices_id_fk" FOREIGN KEY ("lock_device_id") REFERENCES "public"."devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_credentials" ADD CONSTRAINT "access_credentials_tenant_booking_fk" FOREIGN KEY ("tenant_id","booking_id") REFERENCES "public"."bookings"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_credentials" ADD CONSTRAINT "access_credentials_tenant_grant_fk" FOREIGN KEY ("tenant_id","grant_id") REFERENCES "public"."access_grants"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_credentials" ADD CONSTRAINT "access_credentials_tenant_access_point_fk" FOREIGN KEY ("tenant_id","access_point_id") REFERENCES "public"."access_points"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_credentials" ADD CONSTRAINT "access_credentials_tenant_lock_device_fk" FOREIGN KEY ("tenant_id","lock_device_id") REFERENCES "public"."devices"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_credentials" ADD CONSTRAINT "access_credentials_tenant_session_fk" FOREIGN KEY ("tenant_id","play_session_id") REFERENCES "public"."play_sessions"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_credentials" ADD CONSTRAINT "access_credentials_tenant_location_fk" FOREIGN KEY ("tenant_id","location_id") REFERENCES "public"."locations"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "access_credentials_tenant_id_unique" ON "access_credentials" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "access_credentials_grant_point_unique" ON "access_credentials" USING btree ("tenant_id","grant_id","access_point_id");--> statement-breakpoint
CREATE UNIQUE INDEX "access_credentials_connection_stable_name_unique" ON "access_credentials" USING btree ("tenant_id","connection_id","stable_name");--> statement-breakpoint
CREATE UNIQUE INDEX "access_credentials_connection_external_reference_unique" ON "access_credentials" USING btree ("tenant_id","connection_id","external_reference") WHERE "access_credentials"."external_reference" is not null;--> statement-breakpoint
CREATE INDEX "access_credentials_grant_id_idx" ON "access_credentials" USING btree ("grant_id");--> statement-breakpoint
CREATE INDEX "access_credentials_access_point_id_idx" ON "access_credentials" USING btree ("access_point_id");--> statement-breakpoint
CREATE INDEX "access_credentials_lock_device_id_idx" ON "access_credentials" USING btree ("lock_device_id");--> statement-breakpoint
CREATE INDEX "access_credentials_retry_idx" ON "access_credentials" USING btree ("status","next_attempt_at");--> statement-breakpoint
ALTER TABLE "access_credentials" DROP COLUMN "access_code";--> statement-breakpoint
ALTER TABLE "access_credentials" ADD CONSTRAINT "access_credentials_attempts_valid" CHECK ("access_credentials"."attempt_count" >= 0 and "access_credentials"."max_attempts" > 0 and "access_credentials"."attempt_count" <= "access_credentials"."max_attempts");
