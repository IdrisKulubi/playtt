# Mobile API contract v1

The mobile API contract is a checked-in compatibility boundary between the
Next.js route handlers and the Expo application. Contract files describe the
current API; they do not generate production code or load runtime secrets.

## Manifest

The manifest lives at `contracts/mobile-api/manifest.json`:

```json
{
  "contractVersion": 1,
  "authModes": {
    "session": "Signed-in user session."
  },
  "endpoints": [
    {
      "id": "bookings.mine",
      "method": "GET",
      "pathTemplate": "/api/bookings/mine",
      "routeFile": "src/app/api/bookings/mine/route.ts",
      "authMode": "session",
      "mobileConsumers": ["playtt-mobile/lib/bookings-api.ts"],
      "successFixture": "fixtures/bookings-mine-success.json",
      "errorFixtures": ["fixtures/bookings-mine-unauthenticated.json"],
      "notes": ["Optional maintenance note."],
      "additiveFields": ["data.bookings[].editable"]
    }
  ]
}
```

Endpoint IDs and method/path-template pairs must be unique. Methods are
uppercase. Each `authMode` must name a mode declared by the manifest. The route
and every mobile consumer path are repository-relative and must exist. The
route file must export the declared HTTP method. `notes` and `additiveFields`
are optional arrays of non-empty strings; all other endpoint fields shown above
are required.

Fixture references may be relative to `contracts/mobile-api` as shown, or may
use the full repository-relative `contracts/mobile-api/...` path. They may not
leave that directory.

## Fixtures

Each fixture has this shape:

```json
{
  "contractVersion": 1,
  "endpoint": "bookings.mine",
  "case": "success",
  "request": {},
  "response": {
    "status": 200,
    "body": {
      "data": {}
    }
  }
}
```

The version must equal the manifest version. A success fixture's `endpoint`
must equal its manifest endpoint ID. An error fixture may instead use
`"endpoint": "*"` when the same generic error contract is shared by multiple
endpoints. A `successFixture` uses a 2xx status and a `{ "data": ... }`
response envelope. Every `errorFixtures` entry uses a 4xx or 5xx status and a
`{ "code": "...", "message": "..." }` envelope.

Fixtures must contain deterministic, non-sensitive examples. Absolute URLs are
rejected unless their hostname is the reserved `invalid` name or ends in
`.invalid`. Authorization values, cookies, passwords, tokens, private keys,
credentials, and other secret-like values are rejected. Use an explicit
redacted or test placeholder when a field itself is part of the contract.

Every JSON fixture beneath `contracts/mobile-api` must be referenced by at
least one endpoint. Shared error fixtures may be referenced by several
endpoints. Version, endpoint, response-role, and orphan checks prevent stale
examples from silently surviving an API change.

## Validation

Run the complete contract gate from the repository root:

```bash
pnpm test:contracts
```

The command first runs dependency-free validator tests in temporary directories,
then validates the checked-in manifest, routes, consumers, and fixtures. The
same command runs in the root `web-quality` GitHub Actions job.

## Known producer/consumer drift

The manifest records known drift separately from the supported endpoint list:

- `POST /api/replays/request` and `GET /api/replays/mine` exist on the server but have no current mobile consumer.
- Mobile contains a dormant `POST /api/coach/chat` call, but the server has no matching route. It is not a supported contract and must stay behind mock mode until that feature is deliberately implemented.
- The server returns an additive Coach `planId`, while the current mobile type does not consume it; Coach cancellation also intentionally ignores its success payload.
- The mobile `UserProfile` type requires `emailVerified`, but the onboarding PATCH success projection omits it. Current callers do not read that field from this response, so the fixture preserves the real payload and the mismatch remains visible for a later additive producer fix or type correction.

User/profile, Replay, and Coach routes map unexpected failures to stable 500
responses with top-level `{ "code", "message" }` envelopes. Typed domain
errors retain their documented codes, messages, and statuses; internal
exception messages are never returned to clients.
