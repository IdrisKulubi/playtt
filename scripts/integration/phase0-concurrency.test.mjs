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

async function insertBooking({ id, start, end, userId = "user-1" }) {
  const bookings = harness.table("bookings")

  try {
    await harness.sql`
      insert into ${bookings} (
        id, user_id, resource_id, status, payment_status, start_time, end_time
      ) values (
        ${id}, ${userId}, 'resource-1', 'pending', 'unpaid', ${start}, ${end}
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

// Mirrors the shared id + user_id predicate in getUserBookingById,
// getBookingPaymentContext, and getEditableBookingForUser.
async function findOwnedBooking({ bookingId, userId }) {
  const bookings = harness.table("bookings")
  const [booking] = await harness.sql`
    select id, user_id, status, payment_status
    from ${bookings}
    where id = ${bookingId} and user_id = ${userId}
    limit 1
  `

  return booking ?? null
}

async function getOwnedBookingPaymentStatus({ bookingId, userId }) {
  const booking = await findOwnedBooking({ bookingId, userId })
  if (!booking) {
    return null
  }

  const payments = harness.table("payments")
  const [latestPayment] = await harness.sql`
    select id, booking_id, user_id, status, provider_reference
    from ${payments}
    where booking_id = ${booking.id}
    order by created_at desc
    limit 1
  `

  return { booking, latestPayment: latestPayment ?? null }
}

// Mirrors cancelUnpaidBooking's conditional owner/state update and single history effect.
async function cancelOwnedPendingBooking({ bookingId, userId }) {
  const bookings = harness.table("bookings")
  const history = harness.table("booking_status_history")

  return harness.sql.begin(async (sql) => {
    const [booking] = await sql`
      update ${bookings}
      set status = 'cancelled', cancelled_at = now()
      where id = ${bookingId}
        and user_id = ${userId}
        and status = 'pending'
        and payment_status = 'unpaid'
      returning id, user_id, status, payment_status
    `

    if (!booking) {
      const [currentBooking] = await sql`
        select id, user_id, status, payment_status
        from ${bookings}
        where id = ${bookingId} and user_id = ${userId}
        limit 1
      `

      return currentBooking ?? null
    }

    await sql`
      insert into ${history} (booking_id, to_status, reason)
      values (${bookingId}, 'cancelled', 'user_cancelled')
    `

    return booking
  })
}

// Mirrors getModificationById(id, user_id), followed by the service booking-id check.
async function findOwnedModification({ bookingId, modificationId, userId }) {
  const modifications = harness.table("booking_modifications")
  const [modification] = await harness.sql`
    select id, booking_id, user_id, status
    from ${modifications}
    where id = ${modificationId} and user_id = ${userId}
    limit 1
  `

  if (!modification || modification.booking_id !== bookingId) {
    return null
  }

  return modification
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

test("booking detail and modification quote/apply reads require the booking owner", async () => {
  const bookingId = randomUUID()
  const ownerId = randomUUID()
  const differentActorId = randomUUID()

  await insertBooking({
    id: bookingId,
    userId: ownerId,
    start: new Date("2031-01-01T10:00:00.000Z"),
    end: new Date("2031-01-01T11:00:00.000Z"),
  })

  const ownerBooking = await findOwnedBooking({ bookingId, userId: ownerId })
  const guessedBooking = await findOwnedBooking({
    bookingId,
    userId: differentActorId,
  })

  assert.equal(ownerBooking?.id, bookingId)
  assert.equal(ownerBooking?.user_id, ownerId)
  assert.equal(guessedBooking, null)
})

test("payment start/status gate latest-payment access on booking ownership", async () => {
  const payments = harness.table("payments")
  const bookingId = randomUUID()
  const paymentId = randomUUID()
  const ownerId = randomUUID()
  const differentActorId = randomUUID()

  await insertBooking({
    id: bookingId,
    userId: ownerId,
    start: new Date("2031-01-05T10:00:00.000Z"),
    end: new Date("2031-01-05T11:00:00.000Z"),
  })
  await harness.sql`
    insert into ${payments} (
      id, booking_id, user_id, status, provider_reference
    ) values (
      ${paymentId}, ${bookingId}, ${ownerId}, 'pending', 'test-reference'
    )
  `

  const ownerStartContext = await findOwnedBooking({
    bookingId,
    userId: ownerId,
  })
  const attackerStartContext = await findOwnedBooking({
    bookingId,
    userId: differentActorId,
  })
  const ownerStatus = await getOwnedBookingPaymentStatus({
    bookingId,
    userId: ownerId,
  })
  const attackerStatus = await getOwnedBookingPaymentStatus({
    bookingId,
    userId: differentActorId,
  })

  assert.equal(ownerStartContext?.id, bookingId)
  assert.equal(attackerStartContext, null)
  assert.equal(ownerStatus?.booking.id, bookingId)
  assert.equal(ownerStatus?.latestPayment?.id, paymentId)
  assert.equal(attackerStatus, null)

  const [storedPayment] = await harness.sql`
    select booking_id, user_id, status, provider_reference
    from ${payments}
    where id = ${paymentId}
  `
  assert.deepEqual(storedPayment, {
    booking_id: bookingId,
    user_id: ownerId,
    status: "pending",
    provider_reference: "test-reference",
  })
})

test("cancellation ownership predicate prevents cross-user mutation", async () => {
  const bookings = harness.table("bookings")
  const history = harness.table("booking_status_history")
  const bookingId = randomUUID()
  const ownerId = randomUUID()
  const differentActorId = randomUUID()

  await insertBooking({
    id: bookingId,
    userId: ownerId,
    start: new Date("2031-01-02T10:00:00.000Z"),
    end: new Date("2031-01-02T11:00:00.000Z"),
  })

  const guessedCancellation = await cancelOwnedPendingBooking({
    bookingId,
    userId: differentActorId,
  })
  const [afterGuess] = await harness.sql`
    select status, payment_status from ${bookings} where id = ${bookingId}
  `

  assert.equal(guessedCancellation, null)
  assert.deepEqual(afterGuess, {
    status: "pending",
    payment_status: "unpaid",
  })
  const historyAfterGuess = await harness.sql`
    select id from ${history} where booking_id = ${bookingId}
  `
  assert.equal(historyAfterGuess.length, 0)

  const ownerCancellation = await cancelOwnedPendingBooking({
    bookingId,
    userId: ownerId,
  })

  assert.equal(ownerCancellation?.id, bookingId)
  assert.equal(ownerCancellation?.user_id, ownerId)
  assert.equal(ownerCancellation?.status, "cancelled")

  const repeatedOwnerCancellation = await cancelOwnedPendingBooking({
    bookingId,
    userId: ownerId,
  })
  const historyAfterOwner = await harness.sql`
    select to_status, reason from ${history} where booking_id = ${bookingId}
  `

  assert.equal(repeatedOwnerCancellation?.status, "cancelled")
  assert.deepEqual(historyAfterOwner, [
    { to_status: "cancelled", reason: "user_cancelled" },
  ])
})

test("modification status requires matching actor, modification, and booking", async () => {
  const bookings = harness.table("bookings")
  const modifications = harness.table("booking_modifications")
  const ownerId = randomUUID()
  const differentActorId = randomUUID()
  const bookingId = randomUUID()
  const otherOwnedBookingId = randomUUID()
  const modificationId = randomUUID()

  await insertBooking({
    id: bookingId,
    userId: ownerId,
    start: new Date("2031-01-03T10:00:00.000Z"),
    end: new Date("2031-01-03T11:00:00.000Z"),
  })
  await insertBooking({
    id: otherOwnedBookingId,
    userId: ownerId,
    start: new Date("2031-01-04T10:00:00.000Z"),
    end: new Date("2031-01-04T11:00:00.000Z"),
  })
  await harness.sql`
    insert into ${modifications} (id, booking_id, user_id, status)
    values (${modificationId}, ${bookingId}, ${ownerId}, 'pending_payment')
  `

  const ownedModification = await findOwnedModification({
    bookingId,
    modificationId,
    userId: ownerId,
  })
  const crossUserGuess = await findOwnedModification({
    bookingId,
    modificationId,
    userId: differentActorId,
  })
  const crossBookingGuess = await findOwnedModification({
    bookingId: otherOwnedBookingId,
    modificationId,
    userId: ownerId,
  })

  assert.equal(ownedModification?.id, modificationId)
  assert.equal(ownedModification?.booking_id, bookingId)
  assert.equal(ownedModification?.user_id, ownerId)
  assert.equal(crossUserGuess, null)
  assert.equal(crossBookingGuess, null)

  const [storedModification] = await harness.sql`
    select booking_id, user_id, status
    from ${modifications}
    where id = ${modificationId}
  `
  assert.deepEqual(storedModification, {
    booking_id: bookingId,
    user_id: ownerId,
    status: "pending_payment",
  })

  const bookingRows = await harness.sql`
    select id from ${bookings}
    where id in (${bookingId}, ${otherOwnedBookingId})
  `
  assert.equal(bookingRows.length, 2)
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

async function confirmOwnedBookingPayment({ bookingId, userId }) {
  const bookings = harness.table("bookings")
  const history = harness.table("booking_status_history")
  const notifications = harness.table("notifications")

  return harness.sql.begin(async (sql) => {
    const [confirmed] = await sql`
      update ${bookings}
      set status = 'confirmed', payment_status = 'paid'
      where id = ${bookingId}
        and user_id = ${userId}
        and status = 'pending'
        and payment_status = 'unpaid'
      returning id
    `

    if (!confirmed) {
      return "already_confirmed"
    }

    await sql`
      insert into ${history} (booking_id, from_status, to_status, reason)
      values (${bookingId}, 'pending', 'confirmed', 'payment_confirmed')
      on conflict do nothing
    `

    await sql`
      insert into ${notifications} (
        booking_id,
        user_id,
        channel,
        template_key,
        recipient
      )
      values (
        ${bookingId},
        ${userId},
        'email',
        'booking_confirmed',
        'player@example.invalid'
      )
      on conflict do nothing
    `

    return "confirmed"
  })
}

test("duplicate payment confirmation keeps one history row and one email notification", async () => {
  const bookingId = randomUUID()
  const userId = randomUUID()
  const start = new Date("2031-06-01T10:00:00.000Z")
  const end = new Date("2031-06-01T11:00:00.000Z")

  assert.equal(
    await insertBooking({ id: bookingId, start, end, userId }),
    "inserted",
  )

  const outcomes = await Promise.all([
    confirmOwnedBookingPayment({ bookingId, userId }),
    confirmOwnedBookingPayment({ bookingId, userId }),
  ])

  assert.ok(outcomes.includes("confirmed"))
  assert.ok(outcomes.includes("already_confirmed"))

  const history = harness.table("booking_status_history")
  const notifications = harness.table("notifications")

  const historyRows = await harness.sql`
    select booking_id, to_status, reason
    from ${history}
    where booking_id = ${bookingId}
  `
  const notificationRows = await harness.sql`
    select booking_id, channel, template_key
    from ${notifications}
    where booking_id = ${bookingId}
  `

  assert.equal(historyRows.length, 1)
  assert.equal(historyRows[0].reason, "payment_confirmed")
  assert.equal(notificationRows.length, 1)
  assert.equal(notificationRows[0].template_key, "booking_confirmed")
})
