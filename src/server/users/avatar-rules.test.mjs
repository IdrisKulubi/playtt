import assert from "node:assert/strict"
import test from "node:test"

import {
  avatarImagePath,
  avatarKeyFromImage,
  avatarObjectKey,
  isAvatarContentType,
  newAvatarFileName,
  ownsAvatarKey,
  parseAvatarParams,
} from "./avatar-rules.ts"

const UUID = "3f2b8c1e-6d4a-4e7b-9c2d-1a2b3c4d5e6f"

test("only jpeg, png and webp photos are accepted", () => {
  assert.equal(isAvatarContentType("image/jpeg"), true)
  assert.equal(isAvatarContentType("image/webp"), true)
  assert.equal(isAvatarContentType("image/gif"), false)
  assert.equal(isAvatarContentType("text/html"), false)
})

test("keys and paths round-trip for a valid avatar", () => {
  const file = newAvatarFileName("image/png", UUID)
  assert.equal(file, `${UUID}.png`)
  assert.equal(avatarObjectKey("user_1", file), `avatars/user_1/${file}`)
  const path = avatarImagePath("user_1", file)
  assert.equal(path, `/api/avatars/user_1/${file}`)
  assert.equal(avatarKeyFromImage(path), `avatars/user_1/${file}`)
})

test("route params reject traversal and unexpected file names", () => {
  assert.equal(parseAvatarParams("..", `${UUID}.jpg`), null)
  assert.equal(parseAvatarParams("user_1", "../secret.jpg"), null)
  assert.equal(parseAvatarParams("user_1", `${UUID}.svg`), null)
  assert.ok(parseAvatarParams("user_1", `${UUID}.jpg`))
})

test("users can only confirm keys under their own prefix", () => {
  assert.equal(ownsAvatarKey("user_1", `avatars/user_1/${UUID}.jpg`), true)
  assert.equal(ownsAvatarKey("user_1", `avatars/user_2/${UUID}.jpg`), false)
  assert.equal(ownsAvatarKey("user_1", `replays/user_1/${UUID}.jpg`), false)
  assert.equal(ownsAvatarKey("user_1", `avatars/user_1/nested/${UUID}.jpg`), false)
})

test("provider photo URLs are not treated as our avatars", () => {
  assert.equal(avatarKeyFromImage("https://lh3.googleusercontent.com/a/photo"), null)
  assert.equal(avatarKeyFromImage(null), null)
})
