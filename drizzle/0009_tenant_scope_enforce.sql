ALTER TABLE "bookings" VALIDATE CONSTRAINT "bookings_tenant_location_fk";--> statement-breakpoint
ALTER TABLE "bookings" VALIDATE CONSTRAINT "bookings_tenant_resource_fk";--> statement-breakpoint
ALTER TABLE "payments" VALIDATE CONSTRAINT "payments_tenant_booking_fk";--> statement-breakpoint
ALTER TABLE "booking_modifications" VALIDATE CONSTRAINT "booking_modifications_tenant_booking_fk";--> statement-breakpoint
ALTER TABLE "booking_status_history" VALIDATE CONSTRAINT "booking_status_history_tenant_booking_fk";--> statement-breakpoint
ALTER TABLE "access_credentials" VALIDATE CONSTRAINT "access_credentials_tenant_booking_fk";--> statement-breakpoint
ALTER TABLE "session_events" VALIDATE CONSTRAINT "session_events_tenant_booking_fk";--> statement-breakpoint
ALTER TABLE "matches" VALIDATE CONSTRAINT "matches_tenant_booking_fk";--> statement-breakpoint
ALTER TABLE "replays" VALIDATE CONSTRAINT "replays_tenant_booking_fk";--> statement-breakpoint
ALTER TABLE "hardware_configs" VALIDATE CONSTRAINT "hardware_configs_tenant_location_fk";--> statement-breakpoint
ALTER TABLE "locations" ALTER COLUMN "tenant_id" SET DEFAULT '33333333-3333-3333-3333-333333333333';--> statement-breakpoint
ALTER TABLE "locations" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "resources" ALTER COLUMN "tenant_id" SET DEFAULT '33333333-3333-3333-3333-333333333333';--> statement-breakpoint
ALTER TABLE "resources" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "tenant_id" SET DEFAULT '33333333-3333-3333-3333-333333333333';--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_modifications" ALTER COLUMN "tenant_id" SET DEFAULT '33333333-3333-3333-3333-333333333333';--> statement-breakpoint
ALTER TABLE "booking_modifications" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_status_history" ALTER COLUMN "tenant_id" SET DEFAULT '33333333-3333-3333-3333-333333333333';--> statement-breakpoint
ALTER TABLE "booking_status_history" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "tenant_id" SET DEFAULT '33333333-3333-3333-3333-333333333333';--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "access_credentials" ALTER COLUMN "tenant_id" SET DEFAULT '33333333-3333-3333-3333-333333333333';--> statement-breakpoint
ALTER TABLE "access_credentials" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "session_events" ALTER COLUMN "tenant_id" SET DEFAULT '33333333-3333-3333-3333-333333333333';--> statement-breakpoint
ALTER TABLE "session_events" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "tenant_id" SET DEFAULT '33333333-3333-3333-3333-333333333333';--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "replays" ALTER COLUMN "tenant_id" SET DEFAULT '33333333-3333-3333-3333-333333333333';--> statement-breakpoint
ALTER TABLE "replays" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "tenant_id" SET DEFAULT '33333333-3333-3333-3333-333333333333';--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "hardware_configs" ALTER COLUMN "tenant_id" SET DEFAULT '33333333-3333-3333-3333-333333333333';--> statement-breakpoint
ALTER TABLE "hardware_configs" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_credit_ledger" ALTER COLUMN "tenant_id" SET DEFAULT '33333333-3333-3333-3333-333333333333';--> statement-breakpoint
ALTER TABLE "booking_credit_ledger" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_credit_balances" ALTER COLUMN "tenant_id" SET DEFAULT '33333333-3333-3333-3333-333333333333';--> statement-breakpoint
ALTER TABLE "booking_credit_balances" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "replay_credit_ledger" ALTER COLUMN "tenant_id" SET DEFAULT '33333333-3333-3333-3333-333333333333';--> statement-breakpoint
ALTER TABLE "replay_credit_ledger" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "replay_credit_balances" ALTER COLUMN "tenant_id" SET DEFAULT '33333333-3333-3333-3333-333333333333';--> statement-breakpoint
ALTER TABLE "replay_credit_balances" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "product_payments" ALTER COLUMN "tenant_id" SET DEFAULT '33333333-3333-3333-3333-333333333333';--> statement-breakpoint
ALTER TABLE "product_payments" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "coach_subscriptions" ALTER COLUMN "tenant_id" SET DEFAULT '33333333-3333-3333-3333-333333333333';--> statement-breakpoint
ALTER TABLE "coach_subscriptions" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "coach_insights" ALTER COLUMN "tenant_id" SET DEFAULT '33333333-3333-3333-3333-333333333333';--> statement-breakpoint
ALTER TABLE "coach_insights" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "coach_training_items" ALTER COLUMN "tenant_id" SET DEFAULT '33333333-3333-3333-3333-333333333333';--> statement-breakpoint
ALTER TABLE "coach_training_items" ALTER COLUMN "tenant_id" SET NOT NULL;
