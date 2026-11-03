// Creates (or resets) the account given to Apple App Review, with two finished, paid
// bookings so Bookings and Progress are not empty. Safe to rerun.
//
//   PLAYTT_REVIEW_EMAIL=review@theplaytt.com PLAYTT_REVIEW_PASSWORD='...' \
//     node --env-file=.env.local scripts/seed-app-review-account.mjs
//
// Leave PLAYTT_REVIEW_PASSWORD unset to have a strong one generated and printed once.
// Never commit the password; put it in App Store Connect > App Review Information.
import { randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import postgres from "postgres";

const TENANT_ID = "33333333-3333-3333-3333-333333333333";
const USER_ID = "app-review-player";
const SEED_MARKER = "app-review-seed";

let url = process.env.POSTGRES_URL;
if (!url) {
  console.error("POSTGRES_URL is not set. Run with: node --env-file=.env.local scripts/seed-app-review-account.mjs");
  process.exit(1);
}
url = url.replace(/^['"]+|['"]+$/g, "").trim();

const email = (process.env.PLAYTT_REVIEW_EMAIL ?? "review@theplaytt.com").trim().toLowerCase();
const generated = !process.env.PLAYTT_REVIEW_PASSWORD;
const password =
  process.env.PLAYTT_REVIEW_PASSWORD ?? `Pt-${randomBytes(9).toString("base64url")}-9`;
if (password.length < 8) {
  console.error("PLAYTT_REVIEW_PASSWORD must be at least 8 characters.");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

try {
  const passwordHash = await hashPassword(password);

  await sql.begin(async (tx) => {
    // An earlier real account may already own this email.
    const existing = await tx`select id from "user" where lower(email) = ${email} limit 1`;
    if (existing.length > 0 && existing[0].id !== USER_ID) {
      throw new Error(`${email} already belongs to another account. Pick a different PLAYTT_REVIEW_EMAIL.`);
    }

    await tx`
      insert into "user" (
        id, name, email, email_verified, phone, phone_verified, skill_level,
        preferred_auth_provider, onboarding_completed_at, early_adopter_opt_in
      ) values (
        ${USER_ID}, 'App Reviewer', ${email}, true, '+254700000001', true, 'intermediate',
        'email', timezone('utc', now()), false
      )
      on conflict (id) do update set
        name = excluded.name,
        email = excluded.email,
        email_verified = true,
        phone = excluded.phone,
        phone_verified = true,
        skill_level = excluded.skill_level,
        preferred_auth_provider = 'email',
        onboarding_completed_at = coalesce("user".onboarding_completed_at, excluded.onboarding_completed_at),
        two_factor_enabled = false,
        updated_at = now()
    `;

    // Email and password sign-in: better-auth keeps the hash on a "credential" account.
    await tx`delete from account where user_id = ${USER_ID} and provider_id = 'credential'`;
    await tx`
      insert into account (id, account_id, provider_id, user_id, password)
      values (${`${USER_ID}-credential`}, ${USER_ID}, 'credential', ${USER_ID}, ${passwordHash})
    `;

    // Old sessions would keep a stale sign-in alive after a password reset.
    await tx`delete from session where user_id = ${USER_ID}`;

    await tx`
      insert into tenant_memberships (tenant_id, user_id, role, status)
      values (${TENANT_ID}, ${USER_ID}, 'customer', 'active')
      on conflict (tenant_id, user_id) do update set role = 'customer', status = 'active', updated_at = now()
    `;

    // A visible player card, so Community has something to show the reviewer.
    await tx`
      insert into player_profiles (user_id, tenant_id, community_visible, bio, play_style)
      values (${USER_ID}, ${TENANT_ID}, true, 'Reviewing PlayTT.', 'all_round')
      on conflict (user_id) do update set community_visible = true, bio = excluded.bio
    `;

    // Two finished, paid bookings in the past (rerunning replaces them).
    await tx`
      delete from payments
      where user_id = ${USER_ID}
        and booking_id in (select id from bookings where user_id = ${USER_ID} and notes = ${SEED_MARKER})
    `;
    await tx`delete from bookings where user_id = ${USER_ID} and notes = ${SEED_MARKER}`;

    const [resource] = await tx`
      select r.id as resource_id, r.location_id
      from resources r
      join locations l on l.id = r.location_id
      where r.tenant_id = ${TENANT_ID}
      order by l.created_at, r.created_at
      limit 1
    `;
    if (!resource) {
      console.warn("No venue table found for the PlayTT tenant, so no sample bookings were created. Run the venue seed first.");
      return;
    }

    const samples = [
      { daysAgo: 3, hour: 18, minutes: 60, group: 2, amount: 800 },
      { daysAgo: 10, hour: 17, minutes: 30, group: 4, amount: 500 },
    ];
    for (const sample of samples) {
      const [booking] = await tx`
        insert into bookings (
          tenant_id, location_id, resource_id, user_id, status, payment_status,
          start_time, end_time, duration_minutes, group_size, currency,
          subtotal_amount, discount_amount, total_amount, notes, confirmed_at
        ) values (
          ${TENANT_ID}, ${resource.location_id}, ${resource.resource_id}, ${USER_ID}, 'completed', 'paid',
          date_trunc('day', now() - make_interval(days => ${sample.daysAgo})) + make_interval(hours => ${sample.hour}),
          date_trunc('day', now() - make_interval(days => ${sample.daysAgo})) + make_interval(hours => ${sample.hour}, mins => ${sample.minutes}),
          ${sample.minutes}, ${sample.group}, 'KES',
          ${sample.amount}, 0, ${sample.amount}, ${SEED_MARKER},
          now() - make_interval(days => ${sample.daysAgo + 1})
        )
        returning id
      `;
      await tx`
        insert into payments (
          tenant_id, booking_id, location_id, user_id, provider, provider_reference,
          amount, currency, status, payment_method, paid_at
        ) values (
          ${TENANT_ID}, ${booking.id}, ${resource.location_id}, ${USER_ID}, 'manual', ${`${SEED_MARKER}-${booking.id}`},
          ${sample.amount}, 'KES', 'paid', 'mpesa', now() - make_interval(days => ${sample.daysAgo + 1})
        )
      `;
    }

    await tx`
      update "user"
      set total_games_played = 2, total_spend = 1300
      where id = ${USER_ID}
    `;
  });

  console.log("App Review account is ready.");
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}${generated ? "   (generated; shown once, save it now)" : ""}`);
} finally {
  await sql.end();
}
