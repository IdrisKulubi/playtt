-- Deterministic Playwright / CI test user. Safe to rerun.
insert into "user" (
  id,
  name,
  email,
  email_verified,
  skill_level,
  preferred_auth_provider,
  onboarding_completed_at
)
values (
  'e2e-test-player',
  'E2E Test Player',
  'e2e@playtt.test',
  true,
  'beginner',
  'email',
  timezone('utc', now())
)
on conflict (id) do update
set
  name = excluded.name,
  email = excluded.email,
  email_verified = excluded.email_verified,
  skill_level = excluded.skill_level,
  preferred_auth_provider = excluded.preferred_auth_provider,
  onboarding_completed_at = excluded.onboarding_completed_at;

insert into session (
  id,
  expires_at,
  token,
  user_id
)
values (
  'e2e-test-session',
  timezone('utc', now()) + interval '90 days',
  'e2e-test-session-token-fixed',
  'e2e-test-player'
)
on conflict (id) do update
set
  expires_at = excluded.expires_at,
  token = excluded.token,
  user_id = excluded.user_id;
