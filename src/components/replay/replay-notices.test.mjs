import assert from "node:assert/strict"
import test from "node:test"

import {
  NETWORK_NOTICE,
  noticeForCaptureFailure,
  noticeForRequestError,
} from "./replay-notices.ts"

test("no session explains booking and closes by itself", () => {
  const notice = noticeForRequestError("SESSION_NOT_ACTIVE")
  assert.match(notice.title, /session/i)
  assert.ok(notice.autoDismissMs)
})

test("a table without a camera says so in plain words", () => {
  const notice = noticeForCaptureFailure("failed", "resource_not_configured")
  assert.equal(notice.title, "This table has no camera yet")
  assert.equal(notice.action, "ok")
})

test("player-facing messages never show codes or internal names", () => {
  const notices = [
    NETWORK_NOTICE,
    ...["SESSION_NOT_ACTIVE", "NO_CREDITS", "REPLAY_IN_FLIGHT", "VENUE_EDGE_UNAVAILABLE", "REPLAY_EDGE_DISABLED", "SOMETHING_NEW"].map(noticeForRequestError),
    ...["buffer_missing", "extraction_failed", "upload_failed", "edge_offline"].map((status) => noticeForCaptureFailure(status, null)),
  ]
  for (const notice of notices) {
    assert.doesNotMatch(`${notice.title} ${notice.detail}`, /[A-Z]{2,}_[A-Z]|VenueEdge|buffer|config/)
  }
})
