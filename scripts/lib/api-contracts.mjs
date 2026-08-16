import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs"
import { isAbsolute, relative, resolve, sep } from "node:path"

export const MOBILE_API_CONTRACT_DIRECTORY = "contracts/mobile-api"
export const MOBILE_API_MANIFEST = `${MOBILE_API_CONTRACT_DIRECTORY}/manifest.json`

const HTTP_METHODS = new Set([
  "DELETE",
  "GET",
  "HEAD",
  "OPTIONS",
  "PATCH",
  "POST",
  "PUT",
])

const ENDPOINT_KEYS = new Set([
  "additiveFields",
  "authMode",
  "errorFixtures",
  "id",
  "method",
  "mobileConsumers",
  "notes",
  "pathTemplate",
  "routeFile",
  "successFixture",
])

function finding(code, path, message) {
  return { code, path, message }
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0
}

function normalizePath(value) {
  return value.replaceAll("\\", "/").replace(/^\.\//, "")
}

function isPortableAbsolutePath(value) {
  return (
    isAbsolute(value) ||
    /^[a-zA-Z]:[\\/]/.test(value) ||
    value.startsWith("\\\\")
  )
}

function resolveRepositoryPath(rootDirectory, value) {
  if (
    !isNonEmptyString(value) ||
    value.includes("\0") ||
    isPortableAbsolutePath(value) ||
    normalizePath(value).split("/").includes("..")
  ) {
    return null
  }

  const absolutePath = resolve(rootDirectory, value)
  const fromRoot = relative(rootDirectory, absolutePath)
  if (fromRoot.startsWith(`..${sep}`) || fromRoot === ".." || isAbsolute(fromRoot)) {
    return null
  }

  return absolutePath
}

function resolveFixturePath(rootDirectory, contractDirectory, value) {
  if (!isNonEmptyString(value)) {
    return null
  }

  const normalized = normalizePath(value)
  const relativeTo = normalized.startsWith(`${MOBILE_API_CONTRACT_DIRECTORY}/`)
    ? rootDirectory
    : contractDirectory
  const absolutePath = resolveRepositoryPath(relativeTo, normalized)

  if (!absolutePath) {
    return null
  }

  const fromContracts = relative(contractDirectory, absolutePath)
  if (
    fromContracts.startsWith(`..${sep}`) ||
    fromContracts === ".." ||
    isAbsolute(fromContracts)
  ) {
    return null
  }

  return absolutePath
}

function readJson(path, findings, findingPath) {
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch (error) {
    findings.push(
      finding(
        "INVALID_JSON",
        findingPath,
        error instanceof Error ? error.message : "File is not valid JSON.",
      ),
    )
    return null
  }
}

function hasMethodExport(source, method) {
  const escaped = method.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return [
    new RegExp(`\\bexport\\s+(?:async\\s+)?function\\s+${escaped}\\b`),
    new RegExp(`\\bexport\\s+const\\s+${escaped}\\b`),
    new RegExp(`\\bexport\\s*\\{[^}]*\\b${escaped}\\b[^}]*\\}`),
  ].some((pattern) => pattern.test(source))
}

function listJsonFiles(directory) {
  if (!existsSync(directory)) {
    return []
  }

  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...listJsonFiles(entryPath))
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(entryPath)
    }
  }
  return files
}

function isSafePlaceholder(value) {
  return (
    /^(?:<[^>]+>|redacted|\*+)$/i.test(value) ||
    /^Bearer\s+<[^>]+>$/i.test(value) ||
    /^(?:dummy|example|fixture|test)(?:[-_].*)?$/i.test(value)
  )
}

function inspectFixtureValues(value, path, findings, seen = new Set()) {
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
      let safeExampleUrl = false
      try {
        const hostname = new URL(trimmed).hostname.toLowerCase()
        safeExampleUrl = hostname === "invalid" || hostname.endsWith(".invalid")
      } catch {
        safeExampleUrl = false
      }
      if (!safeExampleUrl) {
        findings.push(
          finding(
            "FIXTURE_ABSOLUTE_URL",
            path,
            "Fixtures may only use reserved .invalid absolute example URLs.",
          ),
        )
      }
    }

    if (
      /(?:sk_(?:live|test)_|-----BEGIN [A-Z ]*PRIVATE KEY-----|Bearer\s+\S+)/i.test(
        value,
      ) &&
      !isSafePlaceholder(value)
    ) {
      findings.push(
        finding("FIXTURE_SECRET", path, "Fixture contains a secret-like value."),
      )
    }
    return
  }

  if (!value || typeof value !== "object" || seen.has(value)) {
    return
  }
  seen.add(value)

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      inspectFixtureValues(item, `${path}[${index}]`, findings, seen),
    )
    return
  }

  for (const [key, nested] of Object.entries(value)) {
    const nestedPath = `${path}.${key}`
    if (
      /^(?:authorization|cookie|credentials?|password|private[-_ ]?key|secret|token|(?:access|api|refresh|session)[-_ ]?token)$/i.test(
        key,
      ) &&
      nested !== null &&
      nested !== false &&
      nested !== "" &&
      !(typeof nested === "string" && isSafePlaceholder(nested))
    ) {
      findings.push(
        finding("FIXTURE_SECRET", nestedPath, "Fixture contains secret material."),
      )
    }
    inspectFixtureValues(nested, nestedPath, findings, seen)
  }
}

function validateFixture({
  contractVersion,
  endpoint,
  fixturePath,
  fixtureReference,
  fixtureRole,
  findings,
}) {
  const fixture = readJson(fixturePath, findings, fixtureReference)
  if (!isRecord(fixture)) {
    if (fixture !== null) {
      findings.push(
        finding("INVALID_FIXTURE", fixtureReference, "Fixture must be an object."),
      )
    }
    return
  }

  const requiredKeys = [
    "contractVersion",
    "endpoint",
    "case",
    "request",
    "response",
  ]
  for (const key of requiredKeys) {
    if (!Object.hasOwn(fixture, key)) {
      findings.push(
        finding(
          "FIXTURE_FIELD_MISSING",
          fixtureReference,
          `Fixture is missing ${key}.`,
        ),
      )
    }
  }

  if (fixture.contractVersion !== contractVersion) {
    findings.push(
      finding(
        "STALE_FIXTURE_VERSION",
        fixtureReference,
        "Fixture contractVersion does not match the manifest.",
      ),
    )
  }
  const sharedErrorFixture = fixtureRole === "error" && fixture.endpoint === "*"
  if (fixture.endpoint !== endpoint.id && !sharedErrorFixture) {
    findings.push(
      finding(
        "STALE_FIXTURE_ENDPOINT",
        fixtureReference,
        `Fixture endpoint must equal ${endpoint.id}, or * for a shared error.`,
      ),
    )
  }
  if (!isNonEmptyString(fixture.case)) {
    findings.push(
      finding("INVALID_FIXTURE_CASE", fixtureReference, "Fixture case is required."),
    )
  }

  if (!isRecord(fixture.response)) {
    findings.push(
      finding("INVALID_RESPONSE", fixtureReference, "Fixture response must be an object."),
    )
  } else {
    const { status, body } = fixture.response
    if (!Number.isInteger(status) || status < 100 || status > 599) {
      findings.push(
        finding(
          "INVALID_RESPONSE_STATUS",
          fixtureReference,
          "Fixture response status must be an HTTP status integer.",
        ),
      )
    } else if (fixtureRole === "success" && (status < 200 || status > 299)) {
      findings.push(
        finding(
          "STALE_FIXTURE_STATUS",
          fixtureReference,
          "successFixture must use a 2xx response status.",
        ),
      )
    } else if (fixtureRole === "error" && (status < 400 || status > 599)) {
      findings.push(
        finding(
          "STALE_FIXTURE_STATUS",
          fixtureReference,
          "errorFixtures must use a 4xx or 5xx response status.",
        ),
      )
    }

    if (!isRecord(body)) {
      findings.push(
        finding("INVALID_RESPONSE_BODY", fixtureReference, "Response body must be an object."),
      )
    } else if (fixtureRole === "success" && !Object.hasOwn(body, "data")) {
      findings.push(
        finding(
          "INVALID_SUCCESS_ENVELOPE",
          fixtureReference,
          "Successful responses must use a { data } envelope.",
        ),
      )
    } else if (
      fixtureRole === "error" &&
      (!isNonEmptyString(body.code) || !isNonEmptyString(body.message))
    ) {
      findings.push(
        finding(
          "INVALID_ERROR_ENVELOPE",
          fixtureReference,
          "Error responses must use a { code, message } envelope.",
        ),
      )
    }
  }

  inspectFixtureValues(fixture, fixtureReference, findings)
}

export function validateApiContracts(
  rootDirectory,
  { manifestPath = MOBILE_API_MANIFEST } = {},
) {
  const root = resolve(rootDirectory)
  const findings = []
  const absoluteManifestPath = resolveRepositoryPath(root, manifestPath)

  if (!absoluteManifestPath || !existsSync(absoluteManifestPath)) {
    return {
      endpointCount: 0,
      fixtureCount: 0,
      findings: [
        finding("MANIFEST_MISSING", manifestPath, "Mobile API manifest was not found."),
      ],
    }
  }

  const manifest = readJson(absoluteManifestPath, findings, manifestPath)
  const contractDirectory = resolve(root, MOBILE_API_CONTRACT_DIRECTORY)
  if (!isRecord(manifest)) {
    return { endpointCount: 0, fixtureCount: 0, findings }
  }

  if (
    !Object.hasOwn(manifest, "contractVersion") ||
    !["number", "string"].includes(typeof manifest.contractVersion) ||
    String(manifest.contractVersion).trim() === ""
  ) {
    findings.push(
      finding(
        "INVALID_CONTRACT_VERSION",
        manifestPath,
        "Manifest contractVersion must be a non-empty string or number.",
      ),
    )
  }

  if (!Array.isArray(manifest.endpoints)) {
    findings.push(
      finding("INVALID_ENDPOINTS", manifestPath, "Manifest endpoints must be an array."),
    )
    return { endpointCount: 0, fixtureCount: 0, findings }
  }

  const ids = new Set()
  const methodPaths = new Set()
  const referencedFixtures = new Set()
  let fixtureCount = 0

  manifest.endpoints.forEach((endpoint, index) => {
    const endpointPath = `${manifestPath}#endpoints[${index}]`
    if (!isRecord(endpoint)) {
      findings.push(finding("INVALID_ENDPOINT", endpointPath, "Endpoint must be an object."))
      return
    }

    for (const key of [
      "id",
      "method",
      "pathTemplate",
      "routeFile",
      "authMode",
      "mobileConsumers",
      "successFixture",
      "errorFixtures",
    ]) {
      if (!Object.hasOwn(endpoint, key)) {
        findings.push(
          finding("ENDPOINT_FIELD_MISSING", endpointPath, `Endpoint is missing ${key}.`),
        )
      }
    }
    for (const key of Object.keys(endpoint)) {
      if (!ENDPOINT_KEYS.has(key)) {
        findings.push(
          finding("UNKNOWN_ENDPOINT_FIELD", endpointPath, `Unknown endpoint field: ${key}.`),
        )
      }
    }

    if (!isNonEmptyString(endpoint.id)) {
      findings.push(finding("INVALID_ENDPOINT_ID", endpointPath, "Endpoint id is required."))
    } else if (ids.has(endpoint.id)) {
      findings.push(
        finding("DUPLICATE_ENDPOINT_ID", endpointPath, `Duplicate endpoint id: ${endpoint.id}.`),
      )
    } else {
      ids.add(endpoint.id)
    }

    const method = isNonEmptyString(endpoint.method)
      ? endpoint.method.toUpperCase()
      : ""
    if (!HTTP_METHODS.has(method) || endpoint.method !== method) {
      findings.push(
        finding("INVALID_ENDPOINT_METHOD", endpointPath, "Endpoint method must be uppercase HTTP."),
      )
    }
    if (
      !isNonEmptyString(endpoint.pathTemplate) ||
      !endpoint.pathTemplate.startsWith("/") ||
      /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(endpoint.pathTemplate)
    ) {
      findings.push(
        finding("INVALID_ENDPOINT_PATH", endpointPath, "Endpoint path must be root-relative."),
      )
    }
    if (method && isNonEmptyString(endpoint.pathTemplate)) {
      const key = `${method} ${endpoint.pathTemplate}`
      if (methodPaths.has(key)) {
        findings.push(
          finding("DUPLICATE_METHOD_PATH", endpointPath, `Duplicate endpoint: ${key}.`),
        )
      } else {
        methodPaths.add(key)
      }
    }

    if (!isNonEmptyString(endpoint.authMode)) {
      findings.push(
        finding("INVALID_ENDPOINT_AUTH", endpointPath, "Endpoint auth is required."),
      )
    } else if (
      isRecord(manifest.authModes) &&
      !Object.hasOwn(manifest.authModes, endpoint.authMode)
    ) {
      findings.push(
        finding(
          "INVALID_ENDPOINT_AUTH",
          endpointPath,
          `Unknown authMode: ${endpoint.authMode}.`,
        ),
      )
    }

    const routePath = resolveRepositoryPath(root, endpoint.routeFile)
    if (!routePath) {
      findings.push(
        finding("UNSAFE_ROUTE_PATH", endpointPath, "routeFile must stay inside the repository."),
      )
    } else if (!existsSync(routePath) || !statSync(routePath).isFile()) {
      findings.push(
        finding("ROUTE_FILE_MISSING", endpoint.routeFile, "Route file does not exist."),
      )
    } else if (HTTP_METHODS.has(method)) {
      const source = readFileSync(routePath, "utf8")
      if (!hasMethodExport(source, method)) {
        findings.push(
          finding(
            "ROUTE_METHOD_MISSING",
            endpoint.routeFile,
            `Route file does not export ${method}.`,
          ),
        )
      }
    }

    if (
      !Array.isArray(endpoint.mobileConsumers) ||
      endpoint.mobileConsumers.length === 0
    ) {
      findings.push(
        finding("INVALID_CONSUMERS", endpointPath, "Endpoint consumers must be non-empty."),
      )
    } else {
      for (const consumer of endpoint.mobileConsumers) {
        const consumerPath = resolveRepositoryPath(root, consumer)
        if (!consumerPath) {
          findings.push(
            finding("UNSAFE_CONSUMER_PATH", endpointPath, "Consumer path is unsafe."),
          )
        } else if (!existsSync(consumerPath)) {
          findings.push(
            finding("CONSUMER_MISSING", consumer, "Consumer path does not exist."),
          )
        }
      }
    }

    if (
      endpoint.notes !== undefined &&
      (!Array.isArray(endpoint.notes) ||
        endpoint.notes.some((note) => !isNonEmptyString(note)))
    ) {
      findings.push(
        finding(
          "INVALID_NOTES",
          endpointPath,
          "notes must be an array of non-empty strings.",
        ),
      )
    }
    if (
      endpoint.additiveFields !== undefined &&
      (!Array.isArray(endpoint.additiveFields) ||
        endpoint.additiveFields.some((field) => !isNonEmptyString(field)))
    ) {
      findings.push(
        finding(
          "INVALID_ADDITIVE_FIELDS",
          endpointPath,
          "additiveFields must be an array of non-empty strings.",
        ),
      )
    }

    const fixtureReferences = []
    if (isNonEmptyString(endpoint.successFixture)) {
      fixtureReferences.push({ reference: endpoint.successFixture, role: "success" })
    } else {
      findings.push(
        finding("INVALID_SUCCESS_FIXTURE", endpointPath, "successFixture is required."),
      )
    }
    if (Array.isArray(endpoint.errorFixtures)) {
      endpoint.errorFixtures.forEach((reference) =>
        fixtureReferences.push({ reference, role: "error" }),
      )
    } else {
      findings.push(
        finding("INVALID_ERROR_FIXTURES", endpointPath, "errorFixtures must be an array."),
      )
    }

    const cases = new Set()
    for (const { reference, role } of fixtureReferences) {
      fixtureCount += 1
      const fixturePath = resolveFixturePath(root, contractDirectory, reference)
      if (!fixturePath) {
        findings.push(
          finding(
            "UNSAFE_FIXTURE_PATH",
            endpointPath,
            "Fixture path must stay under contracts/mobile-api.",
          ),
        )
        continue
      }
      referencedFixtures.add(fixturePath)
      if (!existsSync(fixturePath) || !statSync(fixturePath).isFile()) {
        findings.push(finding("FIXTURE_MISSING", reference, "Fixture file does not exist."))
        continue
      }

      validateFixture({
        contractVersion: manifest.contractVersion,
        endpoint,
        fixturePath,
        fixtureReference: reference,
        fixtureRole: role,
        findings,
      })
      const parsed = readJson(fixturePath, [], reference)
      if (isRecord(parsed) && isNonEmptyString(parsed.case)) {
        if (cases.has(parsed.case)) {
          findings.push(
            finding("DUPLICATE_FIXTURE_CASE", reference, `Duplicate case: ${parsed.case}.`),
          )
        }
        cases.add(parsed.case)
      }
    }
  })

  for (const fixturePath of listJsonFiles(contractDirectory)) {
    if (fixturePath === absoluteManifestPath) {
      continue
    }
    if (!referencedFixtures.has(fixturePath)) {
      findings.push(
        finding(
          "ORPHAN_FIXTURE",
          normalizePath(relative(root, fixturePath)),
          "Fixture is not referenced by the manifest.",
        ),
      )
    }
  }

  return {
    endpointCount: manifest.endpoints.length,
    fixtureCount,
    findings,
  }
}
