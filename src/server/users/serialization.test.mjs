import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { serializeUserProfile } from "./serialization.ts"

const REQUIRED_MOBILE_USER_FIELDS = [
  "id",
  "name",
  "email",
  "emailVerified",
]

function readFixture(name) {
  const url = new URL(
    `../../../contracts/mobile-api/fixtures/${name}`,
    import.meta.url,
  )
  return JSON.parse(readFileSync(url, "utf8"))
}

test("serializes the shared user profile projection", () => {
  const profile = {
    id: "user-1",
    name: "Amani N.",
    email: "amani@example.test",
    emailVerified: true,
    image: null,
    phone: "+254712345678",
    skillLevel: "intermediate",
    referralSource: "friend",
    playIntent: "training",
    earlyAdopterOptIn: true,
    onboardingCompletedAt: new Date("2026-08-10T08:30:00.000Z"),
  }

  assert.deepEqual(serializeUserProfile(profile), {
    ...profile,
    onboardingCompletedAt: "2026-08-10T08:30:00.000Z",
  })
})

for (const fixtureName of [
  "user.onboarding.patch.success.json",
  "user.profile.patch.success.json",
]) {
  test(`${fixtureName} satisfies required mobile UserProfile fields`, () => {
    const fixture = readFixture(fixtureName)
    const user = fixture.response?.body?.data?.user

    assert.equal(fixture.response?.status, 200)
    assert.equal(typeof user, "object")
    for (const field of REQUIRED_MOBILE_USER_FIELDS) {
      assert.ok(Object.hasOwn(user, field), `missing required field: ${field}`)
    }
    assert.equal(typeof user.emailVerified, "boolean")
  })
}
