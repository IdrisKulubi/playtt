import { randomBytes } from "node:crypto"

import postgres from "postgres"

export const TEST_DATABASE_CONFIRMATION =
  "CREATE_AND_DROP_ISOLATED_PLAYTT_TEST_SCHEMA"
export const TEST_SCHEMA_PREFIX = "playtt_test_"

function databaseTarget(value, variableName) {
  let url

  try {
    url = new URL(value)
  } catch {
    throw new Error(`${variableName} must be a valid PostgreSQL URL.`)
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error(`${variableName} must use postgres:// or postgresql://.`)
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ""))
  if (!url.hostname || !database) {
    throw new Error(`${variableName} must include a host and database name.`)
  }

  return `${url.hostname.toLowerCase()}:${url.port || "5432"}/${database}`
}

export function resolveDisposableDatabaseConfig(environment = process.env) {
  const testUrl = environment.PLAYTT_TEST_DATABASE_URL?.trim()
  if (!testUrl) {
    throw new Error(
      "PLAYTT_TEST_DATABASE_URL is required. The integration harness never loads .env.local."
    )
  }

  databaseTarget(testUrl, "PLAYTT_TEST_DATABASE_URL")

  if (environment.PLAYTT_TEST_DATABASE_CONFIRM !== TEST_DATABASE_CONFIRMATION) {
    throw new Error(
      `PLAYTT_TEST_DATABASE_CONFIRM must equal ${TEST_DATABASE_CONFIRMATION}.`
    )
  }

  const applicationUrl = environment.POSTGRES_URL?.trim()
  if (
    applicationUrl &&
    databaseTarget(applicationUrl, "POSTGRES_URL") ===
      databaseTarget(testUrl, "PLAYTT_TEST_DATABASE_URL")
  ) {
    throw new Error(
      "PLAYTT_TEST_DATABASE_URL must not target the same database as POSTGRES_URL."
    )
  }

  return { url: testUrl }
}

export function createDisposableSchemaName({
  now = Date.now(),
  processId = process.pid,
  entropy = randomBytes(6).toString("hex"),
} = {}) {
  const schemaName = `${TEST_SCHEMA_PREFIX}${now.toString(36)}_${processId}_${entropy}`
  assertDisposableSchemaName(schemaName)
  return schemaName
}

export function assertDisposableSchemaName(schemaName) {
  if (
    typeof schemaName !== "string" ||
    schemaName.length > 63 ||
    !/^playtt_test_[a-z0-9]+_[0-9]+_[a-f0-9]{12}$/.test(schemaName)
  ) {
    throw new Error(`Refusing unsafe disposable schema name: ${schemaName}`)
  }
}

async function installPhase0ConcurrencyDdl(sql, schemaName) {
  const bookings = sql(`${schemaName}.bookings`)
  const bookingStatusHistory = sql(`${schemaName}.booking_status_history`)
  const bookingModifications = sql(`${schemaName}.booking_modifications`)
  const payments = sql(`${schemaName}.payments`)
  const bookingCreditBalances = sql(`${schemaName}.booking_credit_balances`)
  const bookingCreditLedger = sql(`${schemaName}.booking_credit_ledger`)
  const productPayments = sql(`${schemaName}.product_payments`)
  const replayCreditBalances = sql(`${schemaName}.replay_credit_balances`)
  const replayCreditLedger = sql(`${schemaName}.replay_credit_ledger`)
  const coachSubscriptions = sql(`${schemaName}.coach_subscriptions`)
  const notifications = sql(`${schemaName}.notifications`)

  await sql`
    create table ${bookings} (
      id text primary key,
      user_id text not null,
      resource_id text not null,
      status text not null,
      payment_status text not null,
      start_time timestamptz not null,
      end_time timestamptz not null,
      cancelled_at timestamptz,
      revision integer not null default 0,
      constraint bookings_end_after_start check (end_time > start_time),
      constraint bookings_no_overlap_test
        exclude using gist (tstzrange(start_time, end_time, '[)') with &&)
        where (status in ('pending', 'confirmed'))
    )
  `

  await sql`
    create table ${bookingStatusHistory} (
      id bigint generated always as identity primary key,
      booking_id text not null references ${bookings}(id) on delete cascade,
      from_status text,
      to_status text not null,
      reason text not null,
      created_at timestamptz not null default now()
    )
  `

  await sql`
    create unique index booking_status_history_logical_unique
      on ${bookingStatusHistory} (booking_id, to_status, reason)
      where reason in ('payment_confirmed', 'payment_window_expired', 'user_cancelled')
  `

  await sql`
    create table ${payments} (
      id text primary key,
      booking_id text not null references ${bookings}(id) on delete cascade,
      user_id text not null,
      status text not null default 'pending',
      provider_reference text,
      created_at timestamptz not null default now()
    )
  `

  await sql`
    create table ${bookingModifications} (
      id text primary key,
      booking_id text not null references ${bookings}(id) on delete cascade,
      user_id text not null,
      status text not null,
      credit_amount numeric(12, 2) not null default 0,
      applied_at timestamptz
    )
  `

  await sql`
    create table ${bookingCreditBalances} (
      user_id text primary key,
      balance_amount numeric(12, 2) not null default 0
    )
  `

  await sql`
    create table ${bookingCreditLedger} (
      id bigint generated always as identity primary key,
      booking_id text not null references ${bookings}(id) on delete cascade,
      booking_modification_id text not null references ${bookingModifications}(id),
      user_id text not null,
      delta_amount numeric(12, 2) not null,
      reason text not null,
      created_at timestamptz not null default now()
    )
  `

  await sql`
    create unique index booking_credit_ledger_modification_reason_unique
      on ${bookingCreditLedger} (booking_modification_id, reason)
      where booking_modification_id is not null
  `

  await sql`
    create table ${productPayments} (
      id text primary key,
      user_id text not null,
      product_type text not null default 'replay_pack',
      status text not null default 'pending',
      paid_at timestamptz
    )
  `

  await sql`
    create table ${replayCreditBalances} (
      user_id text primary key,
      balance integer not null default 0,
      updated_at timestamptz not null default now()
    )
  `

  await sql`
    create table ${replayCreditLedger} (
      id bigint generated always as identity primary key,
      user_id text not null,
      delta integer not null,
      reason text not null,
      product_payment_id text references ${productPayments}(id) on delete set null,
      created_at timestamptz not null default now()
    )
  `

  await sql`
    create unique index replay_credit_ledger_product_payment_reason_unique
      on ${replayCreditLedger} (product_payment_id, reason)
      where product_payment_id is not null
  `

  await sql`
    create table ${notifications} (
      id bigint generated always as identity primary key,
      booking_id text not null references ${bookings}(id) on delete cascade,
      user_id text not null,
      channel text not null,
      template_key text not null,
      recipient text,
      created_at timestamptz not null default now()
    )
  `

  await sql`
    create unique index notifications_booking_email_template_unique
      on ${notifications} (booking_id, channel, template_key)
      where channel = 'email' and template_key = 'booking_confirmed'
  `

  await sql`
    create table ${coachSubscriptions} (
      id bigint generated always as identity primary key,
      user_id text not null unique,
      status text not null default 'active',
      plan_id text not null default 'coach_monthly',
      current_period_end timestamptz not null,
      cancel_at_period_end boolean not null default false,
      updated_at timestamptz not null default now()
    )
  `
}

export async function createDisposablePostgresHarness(
  environment = process.env
) {
  const { url } = resolveDisposableDatabaseConfig(environment)
  const schemaName = createDisposableSchemaName()
  const sql = postgres(url, {
    max: 6,
    connect_timeout: 5,
    idle_timeout: 2,
  })
  let schemaCreated = false
  let tornDown = false

  try {
    assertDisposableSchemaName(schemaName)
    await sql`create schema ${sql(schemaName)}`
    schemaCreated = true
    await installPhase0ConcurrencyDdl(sql, schemaName)
  } catch (error) {
    if (schemaCreated) {
      assertDisposableSchemaName(schemaName)
      await sql`drop schema if exists ${sql(schemaName)} cascade`
    }
    await sql.end({ timeout: 2 })
    throw error
  }

  return {
    sql,
    schemaName,
    table(tableName) {
      if (!/^[a-z][a-z0-9_]*$/.test(tableName)) {
        throw new Error(`Refusing unsafe test table name: ${tableName}`)
      }
      return sql(`${schemaName}.${tableName}`)
    },
    async teardown() {
      if (tornDown) {
        return
      }
      tornDown = true

      try {
        if (schemaCreated) {
          assertDisposableSchemaName(schemaName)
          await sql`drop schema if exists ${sql(schemaName)} cascade`
          schemaCreated = false
        }
      } finally {
        await sql.end({ timeout: 2 })
      }
    },
  }
}
