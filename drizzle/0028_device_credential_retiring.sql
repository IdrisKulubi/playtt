ALTER TYPE "public"."device_credential_status" ADD VALUE 'retiring';--> statement-breakpoint
CREATE UNIQUE INDEX "device_credentials_retiring_unique" ON "device_credentials" USING btree ("device_id") WHERE "status" = 'retiring';
