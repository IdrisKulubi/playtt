import assert from "node:assert/strict"
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import test from "node:test"

import { validateApiContracts } from "./lib/api-contracts.mjs"

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function createContractRepository(context) {
  const root = mkdtempSync(join(tmpdir(), "playtt-api-contracts-"))
  context.after(() => rmSync(root, { recursive: true, force: true }))

  const manifest = {
    contractVersion: 1,
    authModes: {
      session: "Signed-in user session.",
    },
    endpoints: [
      {
        id: "bookings.mine",
        method: "GET",
        pathTemplate: "/api/bookings/mine",
        routeFile: "src/app/api/bookings/mine/route.ts",
        authMode: "session",
        mobileConsumers: ["playtt-mobile/lib/bookings-api.ts"],
        successFixture: "fixtures/bookings-mine-success.json",
        errorFixtures: ["fixtures/bookings-mine-unauthenticated.json"],
        notes: ["Current bookings contract."],
        additiveFields: ["data.bookings[].editable"],
      },
    ],
  }

  const success = {
    contractVersion: 1,
    endpoint: "bookings.mine",
    case: "success",
    request: { query: { filter: "upcoming" } },
    response: { status: 200, body: { data: { bookings: [] } } },
  }
  const error = {
    contractVersion: 1,
    endpoint: "*",
    case: "unauthenticated",
    request: {},
    response: {
      status: 401,
      body: { code: "UNAUTHENTICATED", message: "Sign in is required." },
    },
  }

  const manifestPath = join(root, "contracts", "mobile-api", "manifest.json")
  const successPath = join(
    root,
    "contracts",
    "mobile-api",
    "fixtures",
    "bookings-mine-success.json",
  )
  const errorPath = join(
    root,
    "contracts",
    "mobile-api",
    "fixtures",
    "bookings-mine-unauthenticated.json",
  )

  writeFileSync(
    (() => {
      const path = join(root, "src", "app", "api", "bookings", "mine", "route.ts")
      mkdirSync(dirname(path), { recursive: true })
      return path
    })(),
    "export async function GET() { return Response.json({ data: {} }) }\n",
  )
  writeFileSync(
    (() => {
      const path = join(root, "playtt-mobile", "lib", "bookings-api.ts")
      mkdirSync(dirname(path), { recursive: true })
      return path
    })(),
    "export const bookingsPath = '/api/bookings/mine'\n",
  )
  writeJson(manifestPath, manifest)
  writeJson(successPath, success)
  writeJson(errorPath, error)

  return {
    error,
    errorPath,
    manifest,
    manifestPath,
    root,
    success,
    successPath,
  }
}

function codes(result) {
  return result.findings.map((item) => item.code)
}

test("accepts a complete mobile API contract", (context) => {
  const fixture = createContractRepository(context)
  const result = validateApiContracts(fixture.root)

  assert.deepEqual(result.findings, [])
  assert.equal(result.endpointCount, 1)
  assert.equal(result.fixtureCount, 2)
})

test("reports missing route and consumer paths", (context) => {
  const fixture = createContractRepository(context)
  fixture.manifest.endpoints[0].routeFile = "src/app/api/missing/route.ts"
  fixture.manifest.endpoints[0].mobileConsumers = ["playtt-mobile/lib/missing.ts"]
  writeJson(fixture.manifestPath, fixture.manifest)

  const result = validateApiContracts(fixture.root)

  assert.ok(codes(result).includes("ROUTE_FILE_MISSING"))
  assert.ok(codes(result).includes("CONSUMER_MISSING"))
})

test("rejects duplicate endpoint ids and method-path pairs", (context) => {
  const fixture = createContractRepository(context)
  fixture.manifest.endpoints.push({
    ...fixture.manifest.endpoints[0],
    successFixture: "fixtures/bookings-mine-success-copy.json",
    errorFixtures: [],
  })
  writeJson(
    join(
      fixture.root,
      "contracts",
      "mobile-api",
      "fixtures",
      "bookings-mine-success-copy.json",
    ),
    fixture.success,
  )
  writeJson(fixture.manifestPath, fixture.manifest)

  const result = validateApiContracts(fixture.root)

  assert.ok(codes(result).includes("DUPLICATE_ENDPOINT_ID"))
  assert.ok(codes(result).includes("DUPLICATE_METHOD_PATH"))
})

test("rejects malformed success and error envelopes", (context) => {
  const fixture = createContractRepository(context)
  writeJson(fixture.successPath, {
    ...fixture.success,
    response: { status: 200, body: { bookings: [] } },
  })
  writeJson(fixture.errorPath, {
    ...fixture.error,
    response: { status: 401, body: { error: "Sign in is required." } },
  })

  const result = validateApiContracts(fixture.root)

  assert.ok(codes(result).includes("INVALID_SUCCESS_ENVELOPE"))
  assert.ok(codes(result).includes("INVALID_ERROR_ENVELOPE"))
})

test("rejects fixture path traversal", (context) => {
  const fixture = createContractRepository(context)
  fixture.manifest.endpoints[0].successFixture = "../../outside.json"
  writeJson(fixture.manifestPath, fixture.manifest)

  const result = validateApiContracts(fixture.root)

  assert.ok(codes(result).includes("UNSAFE_FIXTURE_PATH"))
})

test("reports orphan and stale fixture files", (context) => {
  const fixture = createContractRepository(context)
  writeJson(fixture.errorPath, {
    ...fixture.error,
    contractVersion: 0,
    endpoint: "bookings.other",
    response: { ...fixture.error.response, status: 200 },
  })
  writeJson(
    join(
      fixture.root,
      "contracts",
      "mobile-api",
      "fixtures",
      "orphan.json",
    ),
    fixture.success,
  )

  const result = validateApiContracts(fixture.root)

  assert.ok(codes(result).includes("STALE_FIXTURE_VERSION"))
  assert.ok(codes(result).includes("STALE_FIXTURE_ENDPOINT"))
  assert.ok(codes(result).includes("STALE_FIXTURE_STATUS"))
  assert.ok(codes(result).includes("ORPHAN_FIXTURE"))
})

test("rejects absolute URLs and secret material in fixtures", (context) => {
  const fixture = createContractRepository(context)
  writeJson(fixture.successPath, {
    ...fixture.success,
    request: {
      callbackUrl: "https://production.example.com/callback",
      authorization: "Bearer live-secret-value",
    },
  })

  const result = validateApiContracts(fixture.root)

  assert.ok(codes(result).includes("FIXTURE_ABSOLUTE_URL"))
  assert.ok(codes(result).includes("FIXTURE_SECRET"))
})
