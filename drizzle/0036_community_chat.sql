CREATE TYPE "public"."community_conversation_type" AS ENUM('direct', 'group', 'event');--> statement-breakpoint
CREATE TYPE "public"."community_member_role" AS ENUM('member', 'admin');--> statement-breakpoint
CREATE TYPE "public"."community_member_state" AS ENUM('active', 'request', 'left');--> statement-breakpoint
CREATE TYPE "public"."community_message_kind" AS ENUM('text', 'quick_reply', 'booking_card', 'kudos_prompt', 'system');--> statement-breakpoint
CREATE TABLE "community_conversation_members" (
	"conversation_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"role" "community_member_role" DEFAULT 'member' NOT NULL,
	"state" "community_member_state" DEFAULT 'active' NOT NULL,
	"last_read_seq" bigint DEFAULT 0 NOT NULL,
	"accepted_at" timestamp with time zone,
	"muted_until" timestamp with time zone,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "community_conversation_members_conversation_id_user_id_pk" PRIMARY KEY("conversation_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "community_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"type" "community_conversation_type" DEFAULT 'direct' NOT NULL,
	"direct_key" text,
	"title" text,
	"location_id" uuid,
	"created_by" text,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "community_conversations_direct_key_required" CHECK ("community_conversations"."type" <> 'direct' or "community_conversations"."direct_key" is not null)
);
--> statement-breakpoint
CREATE TABLE "community_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" bigint GENERATED ALWAYS AS IDENTITY (sequence name "community_messages_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_id" uuid DEFAULT '33333333-3333-3333-3333-333333333333' NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" text,
	"kind" "community_message_kind" DEFAULT 'text' NOT NULL,
	"body" text NOT NULL,
	"payload" jsonb,
	"client_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "community_messages_body_length" CHECK (char_length("community_messages"."body") <= 1000)
);
--> statement-breakpoint
ALTER TABLE "community_conversation_members" ADD CONSTRAINT "community_conversation_members_conversation_id_community_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."community_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_conversation_members" ADD CONSTRAINT "community_conversation_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_conversation_members" ADD CONSTRAINT "community_conversation_members_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_conversations" ADD CONSTRAINT "community_conversations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_conversations" ADD CONSTRAINT "community_conversations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_conversations" ADD CONSTRAINT "community_conversations_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_messages" ADD CONSTRAINT "community_messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_messages" ADD CONSTRAINT "community_messages_conversation_id_community_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."community_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_messages" ADD CONSTRAINT "community_messages_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "community_conversation_members_user_state_idx" ON "community_conversation_members" USING btree ("user_id","state");--> statement-breakpoint
CREATE UNIQUE INDEX "community_conversations_direct_key_unique" ON "community_conversations" USING btree ("tenant_id","direct_key");--> statement-breakpoint
CREATE UNIQUE INDEX "community_messages_seq_unique" ON "community_messages" USING btree ("seq");--> statement-breakpoint
CREATE INDEX "community_messages_conversation_seq_idx" ON "community_messages" USING btree ("conversation_id","seq");--> statement-breakpoint
CREATE UNIQUE INDEX "community_messages_client_id_unique" ON "community_messages" USING btree ("conversation_id","sender_id","client_message_id");--> statement-breakpoint
ALTER TABLE "community_reports" ADD CONSTRAINT "community_reports_message_id_community_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."community_messages"("id") ON DELETE set null ON UPDATE no action;