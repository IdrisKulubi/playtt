import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
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
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    address: text("address").notNull(),
    timezone: text("timezone").default("Africa/Nairobi").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
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
  ],
);

export const resources = pgTable(
  "resources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    type: resourceTypeEnum("type").default("pod").notNull(),
    capacity: integer("capacity").default(2).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
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
    uniqueIndex("resources_location_slug_unique").on(table.locationId, table.slug),
    index("resources_location_active_idx").on(table.locationId, table.isActive),
    check("resources_capacity_positive", sql`${table.capacity} > 0`),
  ],
);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
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
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
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

export const bookingStatusHistory = pgTable(
  "booking_status_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
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
  (table) => [index("booking_status_history_booking_idx").on(table.bookingId)],
);

export const hardwareConfigs = pgTable(
  "hardware_configs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
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
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
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
    index("access_credentials_booking_idx").on(table.bookingId),
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
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
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
    index("session_events_booking_idx").on(table.bookingId, table.eventType),
    index("session_events_location_created_idx").on(table.locationId, table.createdAt),
  ],
);

export const matches = pgTable(
  "matches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
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
    uniqueIndex("matches_booking_unique").on(table.bookingId),
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
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
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
    index("replays_booking_idx").on(table.bookingId, table.status),
    index("replays_user_requested_idx").on(table.userId, table.requestedAt),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
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
    index("notifications_booking_channel_idx").on(table.bookingId, table.channel),
    index("notifications_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  twoFactors: many(twoFactor),
  defaultLocation: one(locations, {
    fields: [user.defaultLocationId],
    references: [locations.id],
  }),
  bookings: many(bookings),
  payments: many(payments),
  replays: many(replays),
  notifications: many(notifications),
}));

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

export const locationRelations = relations(locations, ({ many }) => ({
  resources: many(resources),
  bookings: many(bookings),
  payments: many(payments),
  hardwareConfigs: many(hardwareConfigs),
  accessCredentials: many(accessCredentials),
  sessionEvents: many(sessionEvents),
  matches: many(matches),
  replays: many(replays),
  notifications: many(notifications),
}));

export const resourceRelations = relations(resources, ({ one, many }) => ({
  location: one(locations, {
    fields: [resources.locationId],
    references: [locations.id],
  }),
  bookings: many(bookings),
}));

export const bookingRelations = relations(bookings, ({ one, many }) => ({
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
  statusHistory: many(bookingStatusHistory),
  accessCredentials: many(accessCredentials),
  sessionEvents: many(sessionEvents),
  matches: many(matches),
  replays: many(replays),
  notifications: many(notifications),
}));

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
  location: one(locations, {
    fields: [matches.locationId],
    references: [locations.id],
  }),
  replays: many(replays),
}));

export const replayRelations = relations(replays, ({ one }) => ({
  booking: one(bookings, {
    fields: [replays.bookingId],
    references: [bookings.id],
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
}));

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
