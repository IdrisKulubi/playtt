import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const PLAYTT_TENANT_ID = "33333333-3333-3333-3333-333333333333";

export const userSkillLevelEnum = pgEnum("user_skill_level", [
  "beginner",
  "intermediate",
  "pro",
]);

export const authProviderEnum = pgEnum("auth_provider", [
  "email",
  "google",
  "phone_otp",
]);

export const resourceTypeEnum = pgEnum("resource_type", [
  "pod",
  "table",
  "room",
  "tablet",
  "display",
]);

export const bookingStatusEnum = pgEnum("booking_status", [
  "pending",
  "confirmed",
  "cancelled",
  "expired",
  "completed",
  "failed",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "unpaid",
  "pending",
  "paid",
  "failed",
  "cancelled",
  "refunded",
  "partially_refunded",
]);

export const bookingModificationStatusEnum = pgEnum(
  "booking_modification_status",
  ["pending_payment", "applied", "cancelled"],
);

export const paymentProviderEnum = pgEnum("payment_provider", [
  "paystack",
  "mpesa_direct",
  "manual",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "mpesa",
  "card",
  "bank_transfer",
  "cash",
  "manual_override",
]);

export const paymentWebhookInboxStatusEnum = pgEnum(
  "payment_webhook_inbox_status",
  ["received", "processing", "processed", "failed", "dead_letter"],
);

export const outboxEventStatusEnum = pgEnum("outbox_event_status", [
  "pending",
  "processing",
  "processed",
  "dead_letter",
]);

export const hardwareProviderTypeEnum = pgEnum("hardware_provider_type", [
  "ttlock",
  "tuya",
  "sonoff",
  "camera_nvr",
  "push",
]);

export const accessCredentialTypeEnum = pgEnum("access_credential_type", [
  "pin",
  "ekey",
  "bluetooth_unlock",
]);

export const accessCredentialStatusEnum = pgEnum("access_credential_status", [
  "pending",
  "active",
  "expired",
  "revoked",
  "failed",
]);

export const sessionEventTypeEnum = pgEnum("session_event_type", [
  "lights_on",
  "warning_flash",
  "lights_off",
  "door_unlock",
  "door_lock",
  "access_generated",
  "access_revoked",
  "score_update",
  "replay_requested",
  "replay_ready",
  "notification_sent",
]);

export const sessionEventStatusEnum = pgEnum("session_event_status", [
  "pending",
  "success",
  "failed",
  "skipped",
]);

export const matchStatusEnum = pgEnum("match_status", [
  "not_started",
  "in_progress",
  "completed",
  "abandoned",
]);

export const replayStatusEnum = pgEnum("replay_status", [
  "queued",
  "processing",
  "ready",
  "failed",
]);

export const productTypeEnum = pgEnum("product_type", [
  "replay_pack",
  "coach_subscription",
]);

export const coachSubscriptionStatusEnum = pgEnum("coach_subscription_status", [
  "active",
  "past_due",
  "cancelled",
  "expired",
]);

export const replayCreditLedgerReasonEnum = pgEnum(
  "replay_credit_ledger_reason",
  ["pack_purchase", "replay_capture", "admin_adjust", "refund"],
);

export const notificationChannelEnum = pgEnum("notification_channel", [
  "in_app",
  "sms",
  "email",
  "push",
]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "pending",
  "sent",
  "failed",
  "cancelled",
]);

export const tenantStatusEnum = pgEnum("tenant_status", ["active", "suspended"]);

export const tenantMembershipRoleEnum = pgEnum("tenant_membership_role", [
  "customer",
  "operator",
  "owner",
  "support",
]);

export const tenantMembershipStatusEnum = pgEnum("tenant_membership_status", [
  "active",
  "disabled",
]);

export const accessPointKindEnum = pgEnum("access_point_kind", [
  "entrance",
  "hall",
  "resource",
]);

export const playSessionStatusEnum = pgEnum("play_session_status", [
  "held",
  "confirmed",
  "preparing",
  "active",
  "ending",
  "completed",
  "resetting",
  "available",
]);

export const sessionParticipantRoleEnum = pgEnum("session_participant_role", [
  "owner",
  "guest",
]);

export const deviceTypeEnum = pgEnum("device_type", [
  "esp32_controller",
  "ttlock_lock",
  "ttlock_gateway",
]);

export const deviceStatusEnum = pgEnum("device_status", [
  "pending",
  "active",
  "revoked",
]);

export const deviceCredentialStatusEnum = pgEnum("device_credential_status", [
  "active",
  "rotated",
  "revoked",
]);

export const deviceAssignmentRoleEnum = pgEnum("device_assignment_role", [
  "score_input",
  "lock",
  "gateway",
  "display",
]);

export const deviceCommandStatusEnum = pgEnum("device_command_status", [
  "pending",
  "delivered",
  "acknowledged",
  "failed",
  "expired",
  "cancelled",
]);

export const deviceCommandKindEnum = pgEnum("device_command_kind", [
  "apply_config",
  "reset",
  "reboot",
]);

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    status: tenantStatusEnum("status").default("active").notNull(),
    settings: jsonb("settings").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [uniqueIndex("tenants_slug_unique").on(table.slug)],
);

export const brands = pgTable(
  "brands",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("brands_tenant_slug_unique").on(table.tenantId, table.slug),
    uniqueIndex("brands_tenant_id_unique").on(table.tenantId, table.id),
    uniqueIndex("brands_tenant_default_unique")
      .on(table.tenantId)
      .where(sql`${table.isDefault} = true`),
    index("brands_tenant_id_idx").on(table.tenantId),
  ],
);

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    phone: text("phone"),
    phoneVerified: boolean("phone_verified").default(false).notNull(),
    skillLevel: userSkillLevelEnum("skill_level").default("beginner").notNull(),
    preferredAuthProvider: authProviderEnum("preferred_auth_provider")
      .default("email")
      .notNull(),
    totalGamesPlayed: integer("total_games_played").default(0).notNull(),
    totalSpend: numeric("total_spend", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    defaultLocationId: uuid("default_location_id"),
    onboardingCompletedAt: timestamp("onboarding_completed_at", {
      withTimezone: true,
    }),
    referralSource: text("referral_source"),
    playIntent: text("play_intent"),
    earlyAdopterOptIn: boolean("early_adopter_opt_in").default(false).notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    twoFactorEnabled: boolean("two_factor_enabled").default(false),
    organizationId: text("organization_id"),
    role: text("role"),
    supplierId: text("supplier_id"),
  },
  (table) => [
    uniqueIndex("user_phone_unique").on(table.phone),
    index("user_default_location_idx").on(table.defaultLocationId),
  ],
);

export const tenantMemberships = pgTable(
  "tenant_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    role: tenantMembershipRoleEnum("role").default("customer").notNull(),
    status: tenantMembershipStatusEnum("status").default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("tenant_memberships_tenant_user_unique").on(
      table.tenantId,
      table.userId,
    ),
    index("tenant_memberships_user_id_idx").on(table.userId),
    index("tenant_memberships_tenant_status_idx").on(
      table.tenantId,
      table.status,
    ),
  ],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("account_user_id_idx").on(table.userId),
    uniqueIndex("account_provider_account_unique").on(
      table.providerId,
      table.accountId,
    ),
  ],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("verification_identifier_idx").on(table.identifier),
    uniqueIndex("verification_identifier_value_unique").on(
      table.identifier,
      table.value,
    ),
  ],
);

export const twoFactor = pgTable(
  "two_factor",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("two_factor_secret_idx").on(table.secret),
    index("two_factor_user_id_idx").on(table.userId),
  ],
);

export const locations = pgTable(
  "locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(PLAYTT_TENANT_ID)
      .references(() => tenants.id, {
      onDelete: "restrict",
    }),
    brandId: uuid("brand_id").references(() => brands.id, {
      onDelete: "restrict",
    }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    address: text("address").notNull(),
    timezone: text("timezone").default("Africa/Nairobi").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    settings: jsonb("settings").$type<Record<string, unknown>>(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("locations_slug_unique").on(table.slug),
    index("locations_is_active_idx").on(table.isActive),
    index("locations_tenant_id_idx").on(table.tenantId),
    uniqueIndex("locations_tenant_slug_unique").on(table.tenantId, table.slug),
    uniqueIndex("locations_tenant_id_unique").on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.brandId],
      foreignColumns: [brands.tenantId, brands.id],
      name: "locations_tenant_brand_fk",
    }).onDelete("restrict"),
  ],
);

export const zones = pgTable(
  "zones",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("zones_tenant_location_slug_unique").on(
      table.tenantId,
      table.locationId,
      table.slug,
    ),
    uniqueIndex("zones_tenant_id_unique").on(table.tenantId, table.id),
    index("zones_location_id_idx").on(table.locationId),
    index("zones_tenant_id_idx").on(table.tenantId),
    foreignKey({
      columns: [table.tenantId, table.locationId],
      foreignColumns: [locations.tenantId, locations.id],
      name: "zones_tenant_location_fk",
    }).onDelete("restrict"),
  ],
);

export const resourceTypes = pgTable(
  "resource_types",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("resource_types_tenant_code_unique").on(table.tenantId, table.code),
    uniqueIndex("resource_types_tenant_id_unique").on(table.tenantId, table.id),
    index("resource_types_tenant_id_idx").on(table.tenantId),
  ],
);

export const resources = pgTable(
  "resources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(PLAYTT_TENANT_ID)
      .references(() => tenants.id, {
      onDelete: "restrict",
    }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    zoneId: uuid("zone_id").references(() => zones.id, {
      onDelete: "restrict",
    }),
    resourceTypeId: uuid("resource_type_id").references(() => resourceTypes.id, {
      onDelete: "restrict",
    }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    code: text("code"),
    type: resourceTypeEnum("type").default("pod").notNull(),
    ruleset: text("ruleset"),
    capacity: integer("capacity").default(2).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    configuration: jsonb("configuration").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("resources_location_slug_unique").on(table.locationId, table.slug),
    index("resources_location_active_idx").on(table.locationId, table.isActive),
    index("resources_tenant_id_idx").on(table.tenantId),
    uniqueIndex("resources_tenant_location_code_unique")
      .on(table.tenantId, table.locationId, table.code)
      .where(sql`${table.code} is not null`),
    uniqueIndex("resources_tenant_id_unique").on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.locationId],
      foreignColumns: [locations.tenantId, locations.id],
      name: "resources_tenant_location_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.tenantId, table.zoneId],
      foreignColumns: [zones.tenantId, zones.id],
      name: "resources_tenant_zone_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.tenantId, table.resourceTypeId],
      foreignColumns: [resourceTypes.tenantId, resourceTypes.id],
      name: "resources_tenant_resource_type_fk",
    }).onDelete("restrict"),
    check("resources_capacity_positive", sql`${table.capacity} > 0`),
  ],
);

export const resourceCapabilities = pgTable(
  "resource_capabilities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "restrict" }),
    code: text("code").notNull(),
    config: jsonb("config").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("resource_capabilities_resource_code_unique").on(
      table.resourceId,
      table.code,
    ),
    index("resource_capabilities_tenant_id_idx").on(table.tenantId),
    index("resource_capabilities_resource_id_idx").on(table.resourceId),
    foreignKey({
      columns: [table.tenantId, table.resourceId],
      foreignColumns: [resources.tenantId, resources.id],
      name: "resource_capabilities_tenant_resource_fk",
    }).onDelete("restrict"),
  ],
);

export const accessPoints = pgTable(
  "access_points",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    zoneId: uuid("zone_id").references(() => zones.id, {
      onDelete: "restrict",
    }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    kind: accessPointKindEnum("kind").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("access_points_tenant_location_code_unique").on(
      table.tenantId,
      table.locationId,
      table.code,
    ),
    uniqueIndex("access_points_tenant_id_unique").on(table.tenantId, table.id),
    index("access_points_tenant_id_idx").on(table.tenantId),
    index("access_points_location_id_idx").on(table.locationId),
    index("access_points_zone_id_idx").on(table.zoneId),
  ],
);

export const accessPointResources = pgTable(
  "access_point_resources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    accessPointId: uuid("access_point_id")
      .notNull()
      .references(() => accessPoints.id, { onDelete: "restrict" }),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "restrict" }),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("access_point_resources_point_resource_unique").on(
      table.accessPointId,
      table.resourceId,
    ),
    uniqueIndex("access_point_resources_tenant_id_unique").on(
      table.tenantId,
      table.id,
    ),
    index("access_point_resources_tenant_id_idx").on(table.tenantId),
    index("access_point_resources_access_point_id_idx").on(table.accessPointId),
    index("access_point_resources_resource_id_idx").on(table.resourceId),
  ],
);

export const featureFlags = pgTable(
  "feature_flags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    key: text("key").notNull(),
    enabled: boolean("enabled").default(false).notNull(),
    scope: jsonb("scope").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("feature_flags_tenant_key_unique").on(table.tenantId, table.key),
    index("feature_flags_tenant_id_idx").on(table.tenantId),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    correlationId: text("correlation_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_logs_tenant_created_idx").on(table.tenantId, table.createdAt),
    index("audit_logs_tenant_id_idx").on(table.tenantId),
  ],
);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(PLAYTT_TENANT_ID)
      .references(() => tenants.id, {
      onDelete: "restrict",
    }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "restrict" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    status: bookingStatusEnum("status").default("pending").notNull(),
    paymentStatus: paymentStatusEnum("payment_status")
      .default("unpaid")
      .notNull(),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    groupSize: integer("group_size").notNull(),
    currency: text("currency").default("KES").notNull(),
    subtotalAmount: numeric("subtotal_amount", { precision: 12, scale: 2 })
      .notNull(),
    discountAmount: numeric("discount_amount", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
    pricingRuleSnapshot: jsonb("pricing_rule_snapshot").$type<
      Record<string, unknown>
    >(),
    notes: text("notes"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("bookings_tenant_id_idx").on(table.tenantId),
    uniqueIndex("bookings_tenant_id_unique").on(table.tenantId, table.id),
    index("bookings_location_start_idx").on(table.locationId, table.startTime),
    index("bookings_resource_time_idx").on(
      table.resourceId,
      table.startTime,
      table.endTime,
    ),
    index("bookings_user_created_idx").on(table.userId, table.createdAt),
    index("bookings_status_idx").on(table.status, table.paymentStatus),
    check("bookings_end_after_start", sql`${table.endTime} > ${table.startTime}`),
    check(
      "bookings_duration_allowed",
      sql`${table.durationMinutes} in (30, 60)`,
    ),
    check(
      "bookings_discount_not_negative",
      sql`${table.discountAmount} >= 0`,
    ),
    check(
      "bookings_total_not_negative",
      sql`${table.totalAmount} >= 0`,
    ),
    check(
      "bookings_group_size_range",
      sql`${table.groupSize} >= 2 and ${table.groupSize} <= 8`,
    ),
  ],
);

export const bookingModifications = pgTable(
  "booking_modifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(PLAYTT_TENANT_ID)
      .references(() => tenants.id, {
      onDelete: "restrict",
    }),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    status: bookingModificationStatusEnum("status")
      .default("pending_payment")
      .notNull(),
    changeType: text("change_type").notNull(),
    beforeSnapshot: jsonb("before_snapshot")
      .$type<Record<string, unknown>>()
      .notNull(),
    afterSnapshot: jsonb("after_snapshot")
      .$type<Record<string, unknown>>()
      .notNull(),
    deltaAmount: numeric("delta_amount", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    currency: text("currency").default("KES").notNull(),
    paymentId: uuid("payment_id").references(() => payments.id, {
      onDelete: "set null",
    }),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("booking_modifications_tenant_id_idx").on(table.tenantId),
    index("booking_modifications_booking_idx").on(table.bookingId),
    index("booking_modifications_status_idx").on(table.status),
  ],
);

export const bookingCreditBalances = pgTable(
  "booking_credit_balances",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(PLAYTT_TENANT_ID)
      .references(() => tenants.id, {
      onDelete: "restrict",
    }),
    balanceAmount: numeric("balance_amount", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    currency: text("currency").default("KES").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("booking_credit_balances_tenant_id_idx").on(table.tenantId)],
);

export const bookingCreditLedger = pgTable(
  "booking_credit_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(PLAYTT_TENANT_ID)
      .references(() => tenants.id, {
      onDelete: "restrict",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    bookingId: uuid("booking_id").references(() => bookings.id, {
      onDelete: "set null",
    }),
    bookingModificationId: uuid("booking_modification_id").references(
      () => bookingModifications.id,
      { onDelete: "set null" },
    ),
    deltaAmount: numeric("delta_amount", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").default("KES").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("booking_credit_ledger_tenant_id_idx").on(table.tenantId),
    index("booking_credit_ledger_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    index("booking_credit_ledger_booking_idx").on(table.bookingId),
    uniqueIndex("booking_credit_ledger_modification_reason_unique")
      .on(table.bookingModificationId, table.reason)
      .where(sql`${table.bookingModificationId} is not null`),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(PLAYTT_TENANT_ID)
      .references(() => tenants.id, {
      onDelete: "restrict",
    }),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    provider: paymentProviderEnum("provider").default("paystack").notNull(),
    providerReference: text("provider_reference").notNull(),
    providerEventId: text("provider_event_id"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").default("KES").notNull(),
    status: paymentStatusEnum("status").default("pending").notNull(),
    paymentMethod: paymentMethodEnum("payment_method").default("mpesa").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("payments_tenant_id_idx").on(table.tenantId),
    uniqueIndex("payments_provider_reference_unique").on(
      table.provider,
      table.providerReference,
    ),
    index("payments_provider_event_idx").on(table.provider, table.providerEventId),
    index("payments_booking_status_idx").on(table.bookingId, table.status),
    index("payments_user_created_idx").on(table.userId, table.createdAt),
    check("payments_amount_positive", sql`${table.amount} > 0`),
  ],
);

export const paymentWebhookInbox = pgTable(
  "payment_webhook_inbox",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").references(() => tenants.id, {
      onDelete: "restrict",
    }),
    provider: paymentProviderEnum("provider").default("paystack").notNull(),
    providerEventId: text("provider_event_id"),
    payloadHash: text("payload_hash").notNull(),
    signature: text("signature").notNull(),
    eventType: text("event_type").notNull(),
    rawPayload: text("raw_payload").notNull(),
    status: paymentWebhookInboxStatusEnum("status").default("received").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    lastError: text("last_error"),
    availableAt: timestamp("available_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    leaseOwner: text("lease_owner"),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("payment_webhook_inbox_provider_payload_hash_unique").on(
      table.provider,
      table.payloadHash,
    ),
    uniqueIndex("payment_webhook_inbox_provider_event_unique")
      .on(table.provider, table.providerEventId)
      .where(sql`${table.providerEventId} is not null`),
    index("payment_webhook_inbox_status_received_idx").on(
      table.status,
      table.receivedAt,
    ),
    index("payment_webhook_inbox_claim_idx").on(
      table.status,
      table.availableAt,
    ),
    index("payment_webhook_inbox_provider_event_idx").on(
      table.provider,
      table.providerEventId,
    ),
  ],
);

export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").references(() => tenants.id, {
      onDelete: "restrict",
    }),
    venueId: uuid("venue_id").references(() => locations.id, {
      onDelete: "restrict",
    }),
    resourceId: uuid("resource_id").references(() => resources.id, {
      onDelete: "restrict",
    }),
    sessionId: uuid("session_id"),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    eventType: text("event_type").notNull(),
    eventVersion: integer("event_version").default(1).notNull(),
    correlationId: text("correlation_id").notNull(),
    causationId: text("causation_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: outboxEventStatusEnum("status").default("pending").notNull(),
    availableAt: timestamp("available_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    leaseOwner: text("lease_owner"),
    attempts: integer("attempts").default(0).notNull(),
    lastError: text("last_error"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("outbox_events_idempotency_unique").on(table.idempotencyKey),
    index("outbox_events_claim_idx").on(table.status, table.availableAt),
    index("outbox_events_tenant_id_idx").on(table.tenantId),
    index("outbox_events_event_type_idx").on(table.eventType, table.eventVersion),
    foreignKey({
      columns: [table.tenantId, table.venueId],
      foreignColumns: [locations.tenantId, locations.id],
      name: "outbox_events_tenant_venue_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.tenantId, table.resourceId],
      foreignColumns: [resources.tenantId, resources.id],
      name: "outbox_events_tenant_resource_fk",
    }).onDelete("restrict"),
  ],
);

export const playSessions = pgTable(
  "play_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(PLAYTT_TENANT_ID)
      .references(() => tenants.id, {
        onDelete: "restrict",
      }),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "restrict" }),
    status: playSessionStatusEnum("status").default("confirmed").notNull(),
    correlationId: text("correlation_id").notNull(),
    scheduledStartAt: timestamp("scheduled_start_at", { withTimezone: true })
      .notNull(),
    scheduledEndAt: timestamp("scheduled_end_at", { withTimezone: true })
      .notNull(),
    preparedAt: timestamp("prepared_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    resetAt: timestamp("reset_at", { withTimezone: true }),
    configurationSnapshot: jsonb("configuration_snapshot")
      .$type<Record<string, unknown>>()
      .notNull(),
    configurationVersion: integer("configuration_version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("play_sessions_booking_id_unique").on(table.bookingId),
    uniqueIndex("play_sessions_tenant_id_unique").on(table.tenantId, table.id),
    uniqueIndex("play_sessions_tenant_booking_unique").on(
      table.tenantId,
      table.bookingId,
    ),
    index("play_sessions_tenant_id_idx").on(table.tenantId),
    index("play_sessions_status_idx").on(table.status, table.scheduledStartAt),
    check(
      "play_sessions_scheduled_window",
      sql`${table.scheduledEndAt} > ${table.scheduledStartAt}`,
    ),
  ],
);

export const sessionParticipants = pgTable(
  "session_participants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(PLAYTT_TENANT_ID)
      .references(() => tenants.id, {
        onDelete: "restrict",
      }),
    playSessionId: uuid("play_session_id")
      .notNull()
      .references(() => playSessions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    role: sessionParticipantRoleEnum("role").default("owner").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("session_participants_session_user_unique").on(
      table.playSessionId,
      table.userId,
    ),
    uniqueIndex("session_participants_tenant_id_unique").on(
      table.tenantId,
      table.id,
    ),
    index("session_participants_tenant_id_idx").on(table.tenantId),
    index("session_participants_play_session_id_idx").on(table.playSessionId),
  ],
);

export const devices = pgTable(
  "devices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(PLAYTT_TENANT_ID)
      .references(() => tenants.id, { onDelete: "restrict" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    type: deviceTypeEnum("type").notNull(),
    hardwareUid: text("hardware_uid").notNull(),
    firmwareVersion: text("firmware_version"),
    status: deviceStatusEnum("status").default("pending").notNull(),
    capabilityCodes: jsonb("capability_codes")
      .$type<string[]>()
      .default([])
      .notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("devices_tenant_id_unique").on(table.tenantId, table.id),
    uniqueIndex("devices_tenant_hardware_uid_unique").on(
      table.tenantId,
      table.hardwareUid,
    ),
    index("devices_tenant_id_idx").on(table.tenantId),
    index("devices_location_id_idx").on(table.locationId),
    index("devices_status_idx").on(table.status),
  ],
);

export const deviceEnrollments = pgTable(
  "device_enrollments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(PLAYTT_TENANT_ID)
      .references(() => tenants.id, { onDelete: "restrict" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    deviceType: deviceTypeEnum("device_type").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    consumedDeviceId: uuid("consumed_device_id").references(() => devices.id, {
      onDelete: "set null",
    }),
    correlationId: text("correlation_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("device_enrollments_tenant_code_hash_unique").on(
      table.tenantId,
      table.codeHash,
    ),
    index("device_enrollments_tenant_id_idx").on(table.tenantId),
    index("device_enrollments_location_id_idx").on(table.locationId),
    index("device_enrollments_expires_at_idx").on(table.expiresAt),
  ],
);

export const deviceCredentials = pgTable(
  "device_credentials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(PLAYTT_TENANT_ID)
      .references(() => tenants.id, { onDelete: "restrict" }),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    secretHash: text("secret_hash").notNull(),
    status: deviceCredentialStatusEnum("status").default("active").notNull(),
    rotatedAt: timestamp("rotated_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("device_credentials_device_version_unique").on(
      table.deviceId,
      table.version,
    ),
    uniqueIndex("device_credentials_active_unique")
      .on(table.deviceId)
      .where(sql`${table.status} = 'active'`),
    uniqueIndex("device_credentials_tenant_id_unique").on(
      table.tenantId,
      table.id,
    ),
    index("device_credentials_tenant_id_idx").on(table.tenantId),
    index("device_credentials_device_id_idx").on(table.deviceId),
  ],
);

export const deviceAssignments = pgTable(
  "device_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(PLAYTT_TENANT_ID)
      .references(() => tenants.id, { onDelete: "restrict" }),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    resourceId: uuid("resource_id").references(() => resources.id, {
      onDelete: "restrict",
    }),
    role: deviceAssignmentRoleEnum("role").notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true })
      .notNull(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    config: jsonb("config")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    configVersion: integer("config_version").default(1).notNull(),
    appliedConfigVersion: integer("applied_config_version"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("device_assignments_device_open_unique")
      .on(table.tenantId, table.deviceId)
      .where(sql`${table.effectiveTo} is null`),
    uniqueIndex("device_assignments_scoring_resource_role_open_unique")
      .on(table.tenantId, table.resourceId, table.role)
      .where(
        sql`${table.role} = 'score_input' and ${table.resourceId} is not null and ${table.effectiveTo} is null`,
      ),
    uniqueIndex("device_assignments_tenant_id_unique").on(
      table.tenantId,
      table.id,
    ),
    index("device_assignments_tenant_id_idx").on(table.tenantId),
    index("device_assignments_device_id_idx").on(table.deviceId),
    index("device_assignments_resource_id_idx").on(table.resourceId),
    index("device_assignments_effective_window_idx").on(
      table.deviceId,
      table.effectiveFrom,
      table.effectiveTo,
    ),
    check(
      "device_assignments_effective_window",
      sql`${table.effectiveTo} is null or ${table.effectiveTo} > ${table.effectiveFrom}`,
    ),
  ],
);

// PostgreSQL exclusion constraints for both assignment timelines are maintained
// as required custom SQL in migration 0017; Drizzle cannot express them here.

export const deviceHeartbeats = pgTable(
  "device_heartbeats",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(PLAYTT_TENANT_ID)
      .references(() => tenants.id, { onDelete: "restrict" }),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    bootId: text("boot_id").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    firmwareVersion: text("firmware_version"),
    uptimeMs: integer("uptime_ms"),
    wifiRssi: integer("wifi_rssi"),
    freeHeapBytes: integer("free_heap_bytes"),
    metrics: jsonb("metrics")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    correlationId: text("correlation_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("device_heartbeats_tenant_id_unique").on(
      table.tenantId,
      table.id,
    ),
    index("device_heartbeats_tenant_id_idx").on(table.tenantId),
    index("device_heartbeats_device_observed_idx").on(
      table.deviceId,
      table.observedAt,
    ),
  ],
);

export const deviceCommands = pgTable(
  "device_commands",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(PLAYTT_TENANT_ID)
      .references(() => tenants.id, { onDelete: "restrict" }),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    kind: deviceCommandKindEnum("kind").notNull(),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    status: deviceCommandStatusEnum("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    correlationId: text("correlation_id").notNull(),
    causationId: text("causation_id"),
    attemptCount: integer("attempt_count").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(3).notNull(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
    result: jsonb("result").$type<Record<string, unknown>>(),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("device_commands_tenant_id_unique").on(
      table.tenantId,
      table.id,
    ),
    index("device_commands_tenant_id_idx").on(table.tenantId),
    index("device_commands_device_status_idx").on(
      table.deviceId,
      table.status,
      table.expiresAt,
    ),
    index("device_commands_expires_at_idx").on(table.expiresAt),
  ],
);

export const deviceCommandAcks = pgTable(
  "device_command_acks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(PLAYTT_TENANT_ID)
      .references(() => tenants.id, { onDelete: "restrict" }),
    commandId: uuid("command_id")
      .notNull()
      .references(() => deviceCommands.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    idempotencyKey: text("idempotency_key").notNull(),
    success: boolean("success").notNull(),
    result: jsonb("result").$type<Record<string, unknown>>(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("device_command_acks_command_idempotency_unique").on(
      table.commandId,
      table.idempotencyKey,
    ),
    uniqueIndex("device_command_acks_tenant_id_unique").on(
      table.tenantId,
      table.id,
    ),
    index("device_command_acks_tenant_id_idx").on(table.tenantId),
    index("device_command_acks_command_id_idx").on(table.commandId),
  ],
);

export const bookingStatusHistory = pgTable(
  "booking_status_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(PLAYTT_TENANT_ID)
      .references(() => tenants.id, {
      onDelete: "restrict",
    }),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    fromStatus: bookingStatusEnum("from_status"),
    toStatus: bookingStatusEnum("to_status").notNull(),
    reason: text("reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("booking_status_history_tenant_id_idx").on(table.tenantId),
    index("booking_status_history_booking_idx").on(table.bookingId),
    uniqueIndex("booking_status_history_logical_unique")
      .on(table.bookingId, table.toStatus, table.reason)
      .where(
        sql`${table.reason} in ('payment_confirmed', 'payment_window_expired', 'user_cancelled')`,
      ),
  ],
);

export const hardwareConfigs = pgTable(
  "hardware_configs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(PLAYTT_TENANT_ID)
      .references(() => tenants.id, {
      onDelete: "restrict",
    }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    providerType: hardwareProviderTypeEnum("provider_type").notNull(),
    configKey: text("config_key").notNull(),
    encryptedValue: text("encrypted_value").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("hardware_configs_tenant_id_idx").on(table.tenantId),
    uniqueIndex("hardware_configs_location_provider_key_unique").on(
      table.locationId,
      table.providerType,
      table.configKey,
    ),
    index("hardware_configs_location_active_idx").on(table.locationId, table.isActive),
  ],
);

export const accessCredentials = pgTable(
  "access_credentials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(PLAYTT_TENANT_ID)
      .references(() => tenants.id, {
      onDelete: "restrict",
    }),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    playSessionId: uuid("play_session_id").references(() => playSessions.id, {
      onDelete: "set null",
    }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    provider: hardwareProviderTypeEnum("provider")
      .default("ttlock")
      .notNull(),
    credentialType: accessCredentialTypeEnum("credential_type")
      .default("pin")
      .notNull(),
    accessCode: text("access_code"),
    externalReference: text("external_reference"),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
    validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
    status: accessCredentialStatusEnum("status").default("pending").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("access_credentials_tenant_id_idx").on(table.tenantId),
    index("access_credentials_booking_idx").on(table.bookingId),
    index("access_credentials_play_session_id_idx").on(table.playSessionId),
    index("access_credentials_external_reference_idx").on(
      table.provider,
      table.externalReference,
    ),
    check(
      "access_credentials_valid_window",
      sql`${table.validUntil} > ${table.validFrom}`,
    ),
  ],
);

export const sessionEvents = pgTable(
  "session_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(PLAYTT_TENANT_ID)
      .references(() => tenants.id, {
      onDelete: "restrict",
    }),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    playSessionId: uuid("play_session_id").references(() => playSessions.id, {
      onDelete: "set null",
    }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    eventType: sessionEventTypeEnum("event_type").notNull(),
    status: sessionEventStatusEnum("status").default("pending").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    triggeredAt: timestamp("triggered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("session_events_tenant_id_idx").on(table.tenantId),
    index("session_events_booking_idx").on(table.bookingId, table.eventType),
    index("session_events_play_session_id_idx").on(table.playSessionId),
    index("session_events_location_created_idx").on(table.locationId, table.createdAt),
  ],
);

export const matches = pgTable(
  "matches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(PLAYTT_TENANT_ID)
      .references(() => tenants.id, {
      onDelete: "restrict",
    }),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    playSessionId: uuid("play_session_id").references(() => playSessions.id, {
      onDelete: "set null",
    }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    scorePlayerA: integer("score_player_a").default(0).notNull(),
    scorePlayerB: integer("score_player_b").default(0).notNull(),
    status: matchStatusEnum("status").default("not_started").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("matches_tenant_id_idx").on(table.tenantId),
    uniqueIndex("matches_booking_unique").on(table.bookingId),
    index("matches_play_session_id_idx").on(table.playSessionId),
    index("matches_location_status_idx").on(table.locationId, table.status),
    check(
      "matches_scores_not_negative",
      sql`${table.scorePlayerA} >= 0 and ${table.scorePlayerB} >= 0`,
    ),
  ],
);

export const replays = pgTable(
  "replays",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(PLAYTT_TENANT_ID)
      .references(() => tenants.id, {
      onDelete: "restrict",
    }),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    playSessionId: uuid("play_session_id").references(() => playSessions.id, {
      onDelete: "set null",
    }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    matchId: uuid("match_id").references(() => matches.id, { onDelete: "set null" }),
    status: replayStatusEnum("status").default("queued").notNull(),
    videoUrl: text("video_url"),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("replays_tenant_id_idx").on(table.tenantId),
    index("replays_booking_idx").on(table.bookingId, table.status),
    index("replays_play_session_id_idx").on(table.playSessionId),
    index("replays_user_requested_idx").on(table.userId, table.requestedAt),
  ],
);

export const replayCreditBalances = pgTable(
  "replay_credit_balances",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(PLAYTT_TENANT_ID)
      .references(() => tenants.id, {
      onDelete: "restrict",
    }),
    balance: integer("balance").default(0).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("replay_credit_balances_tenant_id_idx").on(table.tenantId)],
);

export const productPayments = pgTable(
  "product_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(PLAYTT_TENANT_ID)
      .references(() => tenants.id, {
      onDelete: "restrict",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    productType: productTypeEnum("product_type").notNull(),
    provider: paymentProviderEnum("provider").default("paystack").notNull(),
    providerReference: text("provider_reference").notNull(),
    providerEventId: text("provider_event_id"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").default("KES").notNull(),
    status: paymentStatusEnum("status").default("pending").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("product_payments_tenant_id_idx").on(table.tenantId),
    uniqueIndex("product_payments_provider_reference_unique").on(
      table.provider,
      table.providerReference,
    ),
    index("product_payments_user_created_idx").on(table.userId, table.createdAt),
    check("product_payments_amount_positive", sql`${table.amount} > 0`),
  ],
);

export const replayCreditLedger = pgTable(
  "replay_credit_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(PLAYTT_TENANT_ID)
      .references(() => tenants.id, {
      onDelete: "restrict",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    reason: replayCreditLedgerReasonEnum("reason").notNull(),
    bookingId: uuid("booking_id").references(() => bookings.id, {
      onDelete: "set null",
    }),
    replayId: uuid("replay_id").references(() => replays.id, {
      onDelete: "set null",
    }),
    productPaymentId: uuid("product_payment_id").references(
      () => productPayments.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("replay_credit_ledger_tenant_id_idx").on(table.tenantId),
    index("replay_credit_ledger_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    uniqueIndex("replay_credit_ledger_product_payment_reason_unique")
      .on(table.productPaymentId, table.reason)
      .where(sql`${table.productPaymentId} is not null`),
  ],
);

export const coachSubscriptions = pgTable(
  "coach_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(PLAYTT_TENANT_ID)
      .references(() => tenants.id, {
      onDelete: "restrict",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: coachSubscriptionStatusEnum("status").default("active").notNull(),
    planId: text("plan_id").default("coach_monthly").notNull(),
    paystackSubscriptionCode: text("paystack_subscription_code"),
    currentPeriodEnd: timestamp("current_period_end", {
      withTimezone: true,
    }).notNull(),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("coach_subscriptions_tenant_id_idx").on(table.tenantId),
    uniqueIndex("coach_subscriptions_user_unique").on(table.userId),
    index("coach_subscriptions_status_idx").on(table.status),
  ],
);

export const coachInsights = pgTable(
  "coach_insights",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(PLAYTT_TENANT_ID)
      .references(() => tenants.id, {
      onDelete: "restrict",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    replayId: uuid("replay_id")
      .notNull()
      .references(() => replays.id, { onDelete: "cascade" }),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    summary: text("summary").notNull(),
    focusAreas: jsonb("focus_areas").$type<string[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("coach_insights_tenant_id_idx").on(table.tenantId),
    index("coach_insights_user_created_idx").on(table.userId, table.createdAt),
    uniqueIndex("coach_insights_replay_unique").on(table.replayId),
  ],
);

export const coachTrainingItems = pgTable(
  "coach_training_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(PLAYTT_TENANT_ID)
      .references(() => tenants.id, {
      onDelete: "restrict",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    insightId: uuid("insight_id").references(() => coachInsights.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    durationMinutes: integer("duration_minutes"),
    sortOrder: integer("sort_order").default(0).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("coach_training_items_tenant_id_idx").on(table.tenantId),
    index("coach_training_items_user_sort_idx").on(table.userId, table.sortOrder),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(PLAYTT_TENANT_ID)
      .references(() => tenants.id, {
      onDelete: "restrict",
    }),
    bookingId: uuid("booking_id").references(() => bookings.id, {
      onDelete: "cascade",
    }),
    locationId: uuid("location_id").references(() => locations.id, {
      onDelete: "restrict",
    }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    channel: notificationChannelEnum("channel").notNull(),
    status: notificationStatusEnum("status").default("pending").notNull(),
    templateKey: text("template_key").notNull(),
    recipient: text("recipient"),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("notifications_tenant_id_idx").on(table.tenantId),
    index("notifications_booking_channel_idx").on(table.bookingId, table.channel),
    index("notifications_user_created_idx").on(table.userId, table.createdAt),
    uniqueIndex("notifications_booking_email_template_unique")
      .on(table.bookingId, table.channel, table.templateKey)
      .where(
        sql`${table.channel} = 'email' and ${table.templateKey} = 'booking_confirmed'`,
      ),
  ],
);

export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  twoFactors: many(twoFactor),
  tenantMemberships: many(tenantMemberships),
  defaultLocation: one(locations, {
    fields: [user.defaultLocationId],
    references: [locations.id],
  }),
  bookings: many(bookings),
  bookingCreditBalance: one(bookingCreditBalances, {
    fields: [user.id],
    references: [bookingCreditBalances.userId],
  }),
  bookingCreditLedger: many(bookingCreditLedger),
  payments: many(payments),
  replays: many(replays),
  notifications: many(notifications),
}));

export const tenantRelations = relations(tenants, ({ many }) => ({
  brands: many(brands),
  memberships: many(tenantMemberships),
  locations: many(locations),
  zones: many(zones),
  resourceTypes: many(resourceTypes),
  resources: many(resources),
  resourceCapabilities: many(resourceCapabilities),
  accessPoints: many(accessPoints),
  accessPointResources: many(accessPointResources),
  featureFlags: many(featureFlags),
  auditLogs: many(auditLogs),
  bookings: many(bookings),
  payments: many(payments),
  notifications: many(notifications),
}));

export const brandRelations = relations(brands, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [brands.tenantId],
    references: [tenants.id],
  }),
  locations: many(locations),
}));

export const tenantMembershipRelations = relations(
  tenantMemberships,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [tenantMemberships.tenantId],
      references: [tenants.id],
    }),
    user: one(user, {
      fields: [tenantMemberships.userId],
      references: [user.id],
    }),
  }),
);

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const twoFactorRelations = relations(twoFactor, ({ one }) => ({
  user: one(user, {
    fields: [twoFactor.userId],
    references: [user.id],
  }),
}));

export const locationRelations = relations(locations, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [locations.tenantId],
    references: [tenants.id],
  }),
  brand: one(brands, {
    fields: [locations.brandId],
    references: [brands.id],
  }),
  zones: many(zones),
  resources: many(resources),
  bookings: many(bookings),
  payments: many(payments),
  hardwareConfigs: many(hardwareConfigs),
  accessCredentials: many(accessCredentials),
  sessionEvents: many(sessionEvents),
  matches: many(matches),
  replays: many(replays),
  notifications: many(notifications),
  accessPoints: many(accessPoints),
  devices: many(devices),
  deviceEnrollments: many(deviceEnrollments),
  deviceAssignments: many(deviceAssignments),
}));

export const zoneRelations = relations(zones, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [zones.tenantId],
    references: [tenants.id],
  }),
  location: one(locations, {
    fields: [zones.locationId],
    references: [locations.id],
  }),
  resources: many(resources),
  accessPoints: many(accessPoints),
}));

export const resourceTypeRelations = relations(resourceTypes, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [resourceTypes.tenantId],
    references: [tenants.id],
  }),
  resources: many(resources),
}));

export const resourceRelations = relations(resources, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [resources.tenantId],
    references: [tenants.id],
  }),
  location: one(locations, {
    fields: [resources.locationId],
    references: [locations.id],
  }),
  zone: one(zones, {
    fields: [resources.zoneId],
    references: [zones.id],
  }),
  resourceType: one(resourceTypes, {
    fields: [resources.resourceTypeId],
    references: [resourceTypes.id],
  }),
  capabilities: many(resourceCapabilities),
  accessPointResources: many(accessPointResources),
  bookings: many(bookings),
}));

export const resourceCapabilityRelations = relations(
  resourceCapabilities,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [resourceCapabilities.tenantId],
      references: [tenants.id],
    }),
    resource: one(resources, {
      fields: [resourceCapabilities.resourceId],
      references: [resources.id],
    }),
  }),
);

export const accessPointRelations = relations(accessPoints, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [accessPoints.tenantId],
    references: [tenants.id],
  }),
  location: one(locations, {
    fields: [accessPoints.locationId],
    references: [locations.id],
  }),
  zone: one(zones, {
    fields: [accessPoints.zoneId],
    references: [zones.id],
  }),
  resourceMappings: many(accessPointResources),
}));

export const accessPointResourceRelations = relations(
  accessPointResources,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [accessPointResources.tenantId],
      references: [tenants.id],
    }),
    accessPoint: one(accessPoints, {
      fields: [accessPointResources.accessPointId],
      references: [accessPoints.id],
    }),
    resource: one(resources, {
      fields: [accessPointResources.resourceId],
      references: [resources.id],
    }),
  }),
);

export const featureFlagRelations = relations(featureFlags, ({ one }) => ({
  tenant: one(tenants, {
    fields: [featureFlags.tenantId],
    references: [tenants.id],
  }),
}));

export const auditLogRelations = relations(auditLogs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [auditLogs.tenantId],
    references: [tenants.id],
  }),
}));

export const bookingRelations = relations(bookings, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [bookings.tenantId],
    references: [tenants.id],
  }),
  location: one(locations, {
    fields: [bookings.locationId],
    references: [locations.id],
  }),
  resource: one(resources, {
    fields: [bookings.resourceId],
    references: [resources.id],
  }),
  user: one(user, {
    fields: [bookings.userId],
    references: [user.id],
  }),
  payments: many(payments),
  modifications: many(bookingModifications),
  creditLedger: many(bookingCreditLedger),
  statusHistory: many(bookingStatusHistory),
  accessCredentials: many(accessCredentials),
  sessionEvents: many(sessionEvents),
  matches: many(matches),
  replays: many(replays),
  notifications: many(notifications),
  playSession: one(playSessions, {
    fields: [bookings.id],
    references: [playSessions.bookingId],
  }),
}));

export const playSessionRelations = relations(playSessions, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [playSessions.tenantId],
    references: [tenants.id],
  }),
  booking: one(bookings, {
    fields: [playSessions.bookingId],
    references: [bookings.id],
  }),
  location: one(locations, {
    fields: [playSessions.locationId],
    references: [locations.id],
  }),
  resource: one(resources, {
    fields: [playSessions.resourceId],
    references: [resources.id],
  }),
  participants: many(sessionParticipants),
}));

export const sessionParticipantRelations = relations(
  sessionParticipants,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [sessionParticipants.tenantId],
      references: [tenants.id],
    }),
    playSession: one(playSessions, {
      fields: [sessionParticipants.playSessionId],
      references: [playSessions.id],
    }),
    user: one(user, {
      fields: [sessionParticipants.userId],
      references: [user.id],
    }),
  }),
);

export const deviceRelations = relations(devices, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [devices.tenantId],
    references: [tenants.id],
  }),
  location: one(locations, {
    fields: [devices.locationId],
    references: [locations.id],
  }),
  credentials: many(deviceCredentials),
  assignments: many(deviceAssignments),
  heartbeats: many(deviceHeartbeats),
  commands: many(deviceCommands),
  commandAcks: many(deviceCommandAcks),
  enrollments: many(deviceEnrollments, {
    relationName: "consumedDevice",
  }),
}));

export const deviceEnrollmentRelations = relations(
  deviceEnrollments,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [deviceEnrollments.tenantId],
      references: [tenants.id],
    }),
    location: one(locations, {
      fields: [deviceEnrollments.locationId],
      references: [locations.id],
    }),
    consumedDevice: one(devices, {
      fields: [deviceEnrollments.consumedDeviceId],
      references: [devices.id],
      relationName: "consumedDevice",
    }),
  }),
);

export const deviceCredentialRelations = relations(
  deviceCredentials,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [deviceCredentials.tenantId],
      references: [tenants.id],
    }),
    device: one(devices, {
      fields: [deviceCredentials.deviceId],
      references: [devices.id],
    }),
  }),
);

export const deviceAssignmentRelations = relations(
  deviceAssignments,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [deviceAssignments.tenantId],
      references: [tenants.id],
    }),
    device: one(devices, {
      fields: [deviceAssignments.deviceId],
      references: [devices.id],
    }),
    location: one(locations, {
      fields: [deviceAssignments.locationId],
      references: [locations.id],
    }),
    resource: one(resources, {
      fields: [deviceAssignments.resourceId],
      references: [resources.id],
    }),
  }),
);

export const deviceHeartbeatRelations = relations(
  deviceHeartbeats,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [deviceHeartbeats.tenantId],
      references: [tenants.id],
    }),
    device: one(devices, {
      fields: [deviceHeartbeats.deviceId],
      references: [devices.id],
    }),
  }),
);

export const deviceCommandRelations = relations(
  deviceCommands,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [deviceCommands.tenantId],
      references: [tenants.id],
    }),
    device: one(devices, {
      fields: [deviceCommands.deviceId],
      references: [devices.id],
    }),
    acknowledgements: many(deviceCommandAcks),
  }),
);

export const deviceCommandAckRelations = relations(
  deviceCommandAcks,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [deviceCommandAcks.tenantId],
      references: [tenants.id],
    }),
    command: one(deviceCommands, {
      fields: [deviceCommandAcks.commandId],
      references: [deviceCommands.id],
    }),
    device: one(devices, {
      fields: [deviceCommandAcks.deviceId],
      references: [devices.id],
    }),
  }),
);

export const bookingModificationRelations = relations(
  bookingModifications,
  ({ one, many }) => ({
    booking: one(bookings, {
      fields: [bookingModifications.bookingId],
      references: [bookings.id],
    }),
    user: one(user, {
      fields: [bookingModifications.userId],
      references: [user.id],
    }),
    payment: one(payments, {
      fields: [bookingModifications.paymentId],
      references: [payments.id],
    }),
    creditLedger: many(bookingCreditLedger),
  }),
);

export const bookingCreditBalanceRelations = relations(
  bookingCreditBalances,
  ({ one }) => ({
    user: one(user, {
      fields: [bookingCreditBalances.userId],
      references: [user.id],
    }),
  }),
);

export const bookingCreditLedgerRelations = relations(
  bookingCreditLedger,
  ({ one }) => ({
    user: one(user, {
      fields: [bookingCreditLedger.userId],
      references: [user.id],
    }),
    booking: one(bookings, {
      fields: [bookingCreditLedger.bookingId],
      references: [bookings.id],
    }),
    modification: one(bookingModifications, {
      fields: [bookingCreditLedger.bookingModificationId],
      references: [bookingModifications.id],
    }),
  }),
);

export const paymentRelations = relations(payments, ({ one }) => ({
  booking: one(bookings, {
    fields: [payments.bookingId],
    references: [bookings.id],
  }),
  location: one(locations, {
    fields: [payments.locationId],
    references: [locations.id],
  }),
  user: one(user, {
    fields: [payments.userId],
    references: [user.id],
  }),
}));

export const bookingStatusHistoryRelations = relations(
  bookingStatusHistory,
  ({ one }) => ({
    booking: one(bookings, {
      fields: [bookingStatusHistory.bookingId],
      references: [bookings.id],
    }),
  }),
);

export const hardwareConfigRelations = relations(
  hardwareConfigs,
  ({ one }) => ({
    location: one(locations, {
      fields: [hardwareConfigs.locationId],
      references: [locations.id],
    }),
  }),
);

export const accessCredentialRelations = relations(
  accessCredentials,
  ({ one }) => ({
    booking: one(bookings, {
      fields: [accessCredentials.bookingId],
      references: [bookings.id],
    }),
    playSession: one(playSessions, {
      fields: [accessCredentials.playSessionId],
      references: [playSessions.id],
    }),
    location: one(locations, {
      fields: [accessCredentials.locationId],
      references: [locations.id],
    }),
  }),
);

export const sessionEventRelations = relations(sessionEvents, ({ one }) => ({
  booking: one(bookings, {
    fields: [sessionEvents.bookingId],
    references: [bookings.id],
  }),
  playSession: one(playSessions, {
    fields: [sessionEvents.playSessionId],
    references: [playSessions.id],
  }),
  location: one(locations, {
    fields: [sessionEvents.locationId],
    references: [locations.id],
  }),
}));

export const matchRelations = relations(matches, ({ one, many }) => ({
  booking: one(bookings, {
    fields: [matches.bookingId],
    references: [bookings.id],
  }),
  playSession: one(playSessions, {
    fields: [matches.playSessionId],
    references: [playSessions.id],
  }),
  location: one(locations, {
    fields: [matches.locationId],
    references: [locations.id],
  }),
  replays: many(replays),
}));

export const replayRelations = relations(replays, ({ one, many }) => ({
  booking: one(bookings, {
    fields: [replays.bookingId],
    references: [bookings.id],
  }),
  playSession: one(playSessions, {
    fields: [replays.playSessionId],
    references: [playSessions.id],
  }),
  location: one(locations, {
    fields: [replays.locationId],
    references: [locations.id],
  }),
  user: one(user, {
    fields: [replays.userId],
    references: [user.id],
  }),
  match: one(matches, {
    fields: [replays.matchId],
    references: [matches.id],
  }),
  coachInsights: many(coachInsights),
}));

export const replayCreditBalanceRelations = relations(
  replayCreditBalances,
  ({ one }) => ({
    user: one(user, {
      fields: [replayCreditBalances.userId],
      references: [user.id],
    }),
  }),
);

export const coachSubscriptionRelations = relations(
  coachSubscriptions,
  ({ one }) => ({
    user: one(user, {
      fields: [coachSubscriptions.userId],
      references: [user.id],
    }),
  }),
);

export const coachInsightRelations = relations(coachInsights, ({ one, many }) => ({
  user: one(user, {
    fields: [coachInsights.userId],
    references: [user.id],
  }),
  replay: one(replays, {
    fields: [coachInsights.replayId],
    references: [replays.id],
  }),
  booking: one(bookings, {
    fields: [coachInsights.bookingId],
    references: [bookings.id],
  }),
  trainingItems: many(coachTrainingItems),
}));

export const coachTrainingItemRelations = relations(
  coachTrainingItems,
  ({ one }) => ({
    user: one(user, {
      fields: [coachTrainingItems.userId],
      references: [user.id],
    }),
    insight: one(coachInsights, {
      fields: [coachTrainingItems.insightId],
      references: [coachInsights.id],
    }),
  }),
);

export const notificationRelations = relations(notifications, ({ one }) => ({
  booking: one(bookings, {
    fields: [notifications.bookingId],
    references: [bookings.id],
  }),
  location: one(locations, {
    fields: [notifications.locationId],
    references: [locations.id],
  }),
  user: one(user, {
    fields: [notifications.userId],
    references: [user.id],
  }),
}));

// Phase 1 note:
// Drizzle does not model the PostgreSQL exclusion constraint we want for overlapping
// confirmed bookings very ergonomically in schema code. Add a migration with:
//   create extension if not exists btree_gist;
//   alter table bookings add constraint bookings_no_overlap
//   exclude using gist (
//     resource_id with =,
//     tstzrange(start_time, end_time, '[)') with &&
//   ) where (status in ('pending', 'confirmed'));
