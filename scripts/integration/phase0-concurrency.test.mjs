import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, before, test } from "node:test"

import { createDisposablePostgresHarness } from "../lib/disposable-postgres.mjs"

let harness

before(async () => {
  harness = await createDisposablePostgresHarness(process.env)
})

after(async () => {
  await harness?.teardown()
})

async function insertBooking({ id, start, end }) {
  const bookings = harness.table("bookings")

  try {
    await harness.sql`
      insert into ${bookings} (
        id, resource_id, status, payment_status, start_time, end_time
      ) values (
        ${id}, 'resource-1', 'pending', 'unpaid', ${start}, ${end}
      )
    `
    return "inserted"
  } catch (error) {
    if (error?.code === "23P01") {
      return "overlap_rejected"
    }
    throw error
  }
}

async function claimBooking({ bookingId, toStatus, paymentStatus, reason }) {
  const bookings = harness.table("bookings")
  const history = harness.table("booking_status_history")

  return harness.sql.begin(async (sql) => {
    const [claimed] = await sql`
      update ${bookings}
      set status = ${toStatus}, payment_status = ${paymentStatus}
      where id = ${bookingId}
        and status = 'pending'
        and payment_status = 'unpaid'
      returning id
    `

    if (!claimed) {
      return false
    }

    await sql`
      insert into ${history} (booking_id, to_status, reason)
      values (${bookingId}, ${toStatus}, ${reason})
    `
    return true
  })
}

async function claimModification({ modificationId, creditAmount }) {
  const modifications = harness.table("booking_modifications")
  const balances = harness.table("booking_credit_balances")
  const ledger = harness.table("booking_credit_ledger")
  const history = harness.table("booking_status_history")

  return harness.sql.begin(async (sql) => {
    const [modification] = await sql`
      select * from ${modifications}
      where id = ${modificationId}
      for update
    `

    if (!modification || modification.status !== "pending_payment") {
      return false
    }

    const [claimed] = await sql`
      update ${modifications}
      set status = 'applied', applied_at = now()
      where id = ${modificationId} and status = 'pending_payment'
      returning id
    `

    if (!claimed) {
      return false
    }

    const [balance] = await sql`
      select balance_amount from ${balances}
      where user_id = ${modification.user_id}
      for update
    `
    const nextBalance = Number(balance.balance_amount) + creditAmount

    await sql`
      update ${balances}
      set balance_amount = ${nextBalance.toFixed(2)}
      where user_id = ${modification.user_id}
    `
    await sql`
      insert into ${ledger} (
        booking_id, booking_modification_id, user_id, delta_amount, reason
      ) values (
        ${modification.booking_id}, ${modification.id},
        ${modification.user_id}, ${creditAmount.toFixed(2)},
        'booking_reduction'
      )
    `
    await sql`
      insert into ${history} (booking_id, to_status, reason)
      values (${modification.booking_id}, 'confirmed', 'booking_modified')
    `
    return true
  })
}

async function claimReplayPack({ productPaymentId, credits }) {
  const payments = harness.table("product_payments")
  const balances = harness.table("replay_credit_balances")
  const ledger = harness.table("replay_credit_ledger")

  return harness.sql.begin(async (sql) => {
    const [payment] = await sql`
      select * from ${payments}
      where id = ${productPaymentId}
      for update
    `

    if (!payment) {
      return "payment_not_found"
    }

    if (payment.status !== "paid") {
      const [claimed] = await sql`
        update ${payments}
        set status = 'paid', paid_at = now()
        where id = ${payment.id} and status = ${payment.status}
        returning id
      `
      assert.ok(claimed)
    }

    const [existingCredit] = await sql`
      select id from ${ledger}
      where product_payment_id = ${payment.id}
        and reason = 'pack_purchase'
      limit 1
    `

    if (existingCredit) {
      return "already_credited"
    }

    await sql`
      insert into ${balances} (user_id, balance)
      values (${payment.user_id}, 0)
      on conflict do nothing
    `
    const [balance] = await sql`
      select balance from ${balances}
      where user_id = ${payment.user_id}
      for update
    `
    await sql`
      update ${balances}
      set balance = ${balance.balance + credits}, updated_at = now()
      where user_id = ${payment.user_id}
    `
    await sql`
      insert into ${ledger} (user_id, delta, reason, product_payment_id)
      values (${payment.user_id}, ${credits}, 'pack_purchase', ${payment.id})
    `
    return "credited"
  })
}

async function claimCoachSubscription({ productPaymentId, userId, periodEnd }) {
  const payments = harness.table("product_payments")
  const subscriptions = harness.table("coach_subscriptions")

  return harness.sql.begin(async (sql) => {
    const [payment] = await sql`
      select product_type, status from ${payments}
      where id = ${productPaymentId} and user_id = ${userId}
      for update
    `

    if (!payment || payment.product_type !== "coach_subscription") {
      return "state_changed"
    }

    if (payment.status === "paid") {
      const [existingSubscription] = await sql`
        select id from ${subscriptions}
        where user_id = ${userId}
        limit 1
      `

      if (existingSubscription) {
        return "already_confirmed"
      }

      const [recoveredSubscription] = await sql`
        insert into ${subscriptions} (
          user_id, status, plan_id, current_period_end, cancel_at_period_end
        ) values (
          ${userId}, 'active', 'coach_monthly', ${periodEnd}, false
        )
        on conflict do nothing
        returning id
      `

      return recoveredSubscription ? "confirmed" : "already_confirmed"
    }

    if (payment.status !== "pending") {
      return "state_changed"
    }

    const [claimedPayment] = await sql`
      update ${payments}
      set status = 'paid', paid_at = now()
      where id = ${productPaymentId}
        and user_id = ${userId}
        and product_type = 'coach_subscription'
        and status = 'pending'
      returning id
    `

    if (!claimedPayment) {
      return "state_changed"
    }

    await sql`
      insert into ${subscriptions} (
        user_id, status, plan_id, current_period_end, cancel_at_period_end
      ) values (
        ${userId}, 'active', 'coach_monthly', ${periodEnd}, false
      )
      on conflict (user_id) do update set
        status = 'active',
        plan_id = 'coach_monthly',
        current_period_end = excluded.current_period_end,
        cancel_at_period_end = false,
        updated_at = now()
    `

    return "confirmed"
  })
}

test("overlapping booking inserts have one winner and adjacent ranges both succeed", async () => {
  const bookings = harness.table("bookings")
  const start = new Date("2030-01-01T10:00:00.000Z")
  const end = new Date("2030-01-01T11:00:00.000Z")
  const overlapping = await Promise.all([
    insertBooking({ id: randomUUID(), start, end }),
    insertBooking({ id: randomUUID(), start, end }),
  ])

  assert.equal(overlapping.filter((result) => result === "inserted").length, 1)
  assert.equal(
    overlapping.filter((result) => result === "overlap_rejected").length,
    1
  )

  await harness.sql`delete from ${bookings}`

  const adjacent = await Promise.all([
    insertBooking({
      id: randomUUID(),
      start: new Date("2030-01-01T10:00:00.000Z"),
      end: new Date("2030-01-01T11:00:00.000Z"),
    }),
    insertBooking({
      id: randomUUID(),
      start: new Date("2030-01-01T11:00:00.000Z"),
      end: new Date("2030-01-01T12:00:00.000Z"),
    }),
  ])

  assert.deepEqual(adjacent, ["inserted", "inserted"])
})

test("confirmation racing expiry or cancellation has one legal winner and one history row", async () => {
  const bookings = harness.table("bookings")
  const history = harness.table("booking_status_history")

  for (const contender of [
    { toStatus: "expired", paymentStatus: "unpaid", reason: "expired" },
    { toStatus: "cancelled", paymentStatus: "unpaid", reason: "cancelled" },
  ]) {
    await harness.sql`delete from ${bookings}`
    const bookingId = randomUUID()
    await insertBooking({
      id: bookingId,
      start: new Date("2030-01-02T10:00:00.000Z"),
      end: new Date("2030-01-02T11:00:00.000Z"),
    })

    const claims = await Promise.all([
      claimBooking({
        bookingId,
        toStatus: "confirmed",
        paymentStatus: "paid",
        reason: "payment_confirmed",
      }),
      claimBooking({ bookingId, ...contender }),
    ])

    assert.equal(claims.filter(Boolean).length, 1)
    const [booking] = await harness.sql`
      select status, payment_status from ${bookings} where id = ${bookingId}
    `
    const rows = await harness.sql`
      select to_status from ${history} where booking_id = ${bookingId}
    `
    assert.equal(rows.length, 1)
    assert.ok(
      (booking.status === "confirmed" && booking.payment_status === "paid") ||
        (booking.status === contender.toStatus &&
          booking.payment_status === "unpaid")
    )
  }
})

test("duplicate modification claims apply and credit exactly once", async () => {
  const bookings = harness.table("bookings")
  const modifications = harness.table("booking_modifications")
  const balances = harness.table("booking_credit_balances")
  const ledger = harness.table("booking_credit_ledger")
  const history = harness.table("booking_status_history")
  await harness.sql`delete from ${bookings}`

  const bookingId = randomUUID()
  const modificationId = randomUUID()
  const userId = randomUUID()
  await insertBooking({
    id: bookingId,
    start: new Date("2030-01-03T10:00:00.000Z"),
    end: new Date("2030-01-03T11:00:00.000Z"),
  })
  await harness.sql`
    update ${bookings}
    set status = 'confirmed', payment_status = 'paid'
    where id = ${bookingId}
  `
  await harness.sql`
    insert into ${modifications} (
      id, booking_id, user_id, status, credit_amount
    ) values (
      ${modificationId}, ${bookingId}, ${userId}, 'pending_payment', '25.00'
    )
  `
  await harness.sql`
    insert into ${balances} (user_id, balance_amount)
    values (${userId}, '0.00')
  `

  const claims = await Promise.all([
    claimModification({ modificationId, creditAmount: 25 }),
    claimModification({ modificationId, creditAmount: 25 }),
  ])

  assert.equal(claims.filter(Boolean).length, 1)
  const [modification] = await harness.sql`
    select status from ${modifications} where id = ${modificationId}
  `
  const [balance] = await harness.sql`
    select balance_amount from ${balances} where user_id = ${userId}
  `
  const ledgerRows = await harness.sql`
    select id from ${ledger} where booking_modification_id = ${modificationId}
  `
  const historyRows = await harness.sql`
    select id from ${history}
    where booking_id = ${bookingId} and reason = 'booking_modified'
  `

  assert.equal(modification.status, "applied")
  assert.equal(Number(balance.balance_amount), 25)
  assert.equal(ledgerRows.length, 1)
  assert.equal(historyRows.length, 1)
})

test("duplicate replay pack payment claims grant one pack and one ledger effect", async () => {
  const payments = harness.table("product_payments")
  const balances = harness.table("replay_credit_balances")
  const ledger = harness.table("replay_credit_ledger")
  const productPaymentId = randomUUID()
  const userId = randomUUID()
  const credits = 5

  await harness.sql`
    insert into ${payments} (id, user_id, status)
    values (${productPaymentId}, ${userId}, 'pending')
  `

  const claims = await Promise.all([
    claimReplayPack({ productPaymentId, credits }),
    claimReplayPack({ productPaymentId, credits }),
  ])

  assert.equal(claims.filter((result) => result === "credited").length, 1)
  assert.equal(
    claims.filter((result) => result === "already_credited").length,
    1
  )

  const [payment] = await harness.sql`
    select status from ${payments} where id = ${productPaymentId}
  `
  const [balance] = await harness.sql`
    select balance from ${balances} where user_id = ${userId}
  `
  const ledgerRows = await harness.sql`
    select delta from ${ledger} where product_payment_id = ${productPaymentId}
  `

  assert.equal(payment.status, "paid")
  assert.equal(balance.balance, credits)
  assert.equal(ledgerRows.length, 1)
  assert.equal(ledgerRows[0].delta, credits)
})

test("an already-paid replay pack without a ledger entry is recovered once", async () => {
  const payments = harness.table("product_payments")
  const balances = harness.table("replay_credit_balances")
  const ledger = harness.table("replay_credit_ledger")
  const productPaymentId = randomUUID()
  const userId = randomUUID()
  const credits = 5

  await harness.sql`
    insert into ${payments} (id, user_id, status, paid_at)
    values (${productPaymentId}, ${userId}, 'paid', now())
  `

  const claims = await Promise.all([
    claimReplayPack({ productPaymentId, credits }),
    claimReplayPack({ productPaymentId, credits }),
  ])

  assert.equal(claims.filter((result) => result === "credited").length, 1)
  assert.equal(
    claims.filter((result) => result === "already_credited").length,
    1
  )

  const [balance] = await harness.sql`
    select balance from ${balances} where user_id = ${userId}
  `
  const ledgerRows = await harness.sql`
    select delta from ${ledger} where product_payment_id = ${productPaymentId}
  `

  assert.equal(balance.balance, credits)
  assert.equal(ledgerRows.length, 1)
  assert.equal(ledgerRows[0].delta, credits)
})

test("duplicate pending Coach confirmations update one subscription period once", async () => {
  const payments = harness.table("product_payments")
  const subscriptions = harness.table("coach_subscriptions")
  const productPaymentId = randomUUID()
  const userId = randomUUID()
  const originalPeriodEnd = new Date("2030-02-01T00:00:00.000Z")
  const renewedPeriodEnd = new Date("2030-03-01T00:00:00.000Z")

  await harness.sql`
    insert into ${payments} (id, user_id, product_type, status)
    values (${productPaymentId}, ${userId}, 'coach_subscription', 'pending')
  `
  await harness.sql`
    insert into ${subscriptions} (user_id, current_period_end)
    values (${userId}, ${originalPeriodEnd})
  `

  const confirmations = await Promise.all([
    claimCoachSubscription({
      productPaymentId,
      userId,
      periodEnd: renewedPeriodEnd,
    }),
    claimCoachSubscription({
      productPaymentId,
      userId,
      periodEnd: renewedPeriodEnd,
    }),
  ])

  assert.equal(
    confirmations.filter((result) => result === "confirmed").length,
    1
  )
  assert.equal(
    confirmations.filter((result) => result === "already_confirmed").length,
    1
  )

  const rows = await harness.sql`
    select current_period_end from ${subscriptions} where user_id = ${userId}
  `
  assert.equal(rows.length, 1)
  assert.equal(
    rows[0].current_period_end.toISOString(),
    renewedPeriodEnd.toISOString()
  )
})

test("an already-paid Coach payment without a subscription recovers once", async () => {
  const payments = harness.table("product_payments")
  const subscriptions = harness.table("coach_subscriptions")
  const productPaymentId = randomUUID()
  const userId = randomUUID()
  const recoveredPeriodEnd = new Date("2030-04-01T00:00:00.000Z")

  await harness.sql`
    insert into ${payments} (id, user_id, product_type, status, paid_at)
    values (
      ${productPaymentId}, ${userId}, 'coach_subscription', 'paid', now()
    )
  `

  const confirmations = await Promise.all([
    claimCoachSubscription({
      productPaymentId,
      userId,
      periodEnd: recoveredPeriodEnd,
    }),
    claimCoachSubscription({
      productPaymentId,
      userId,
      periodEnd: recoveredPeriodEnd,
    }),
  ])

  assert.equal(
    confirmations.filter((result) => result === "confirmed").length,
    1
  )
  assert.equal(
    confirmations.filter((result) => result === "already_confirmed").length,
    1
  )

  const rows = await harness.sql`
    select current_period_end from ${subscriptions} where user_id = ${userId}
  `
  assert.equal(rows.length, 1)
  assert.equal(
    rows[0].current_period_end.toISOString(),
    recoveredPeriodEnd.toISOString()
  )
})

test("an already-paid Coach payment preserves an existing subscription period", async () => {
  const payments = harness.table("product_payments")
  const subscriptions = harness.table("coach_subscriptions")
  const productPaymentId = randomUUID()
  const userId = randomUUID()
  const existingPeriodEnd = new Date("2030-05-01T00:00:00.000Z")
  const proposedPeriodEnd = new Date("2030-06-01T00:00:00.000Z")

  await harness.sql`
    insert into ${payments} (id, user_id, product_type, status, paid_at)
    values (
      ${productPaymentId}, ${userId}, 'coach_subscription', 'paid', now()
    )
  `
  await harness.sql`
    insert into ${subscriptions} (user_id, current_period_end)
    values (${userId}, ${existingPeriodEnd})
  `

  const confirmations = await Promise.all([
    claimCoachSubscription({
      productPaymentId,
      userId,
      periodEnd: proposedPeriodEnd,
    }),
    claimCoachSubscription({
      productPaymentId,
      userId,
      periodEnd: proposedPeriodEnd,
    }),
  ])

  assert.deepEqual(confirmations, ["already_confirmed", "already_confirmed"])

  const rows = await harness.sql`
    select current_period_end from ${subscriptions} where user_id = ${userId}
  `
  assert.equal(rows.length, 1)
  assert.equal(
    rows[0].current_period_end.toISOString(),
    existingPeriodEnd.toISOString()
  )
})
