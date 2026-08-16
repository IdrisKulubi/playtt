import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs"
import { relative, resolve, sep } from "node:path"

export const WEB_ACTIONS_CONTRACT_DIRECTORY = "contracts/web-actions"
export const WEB_ACTIONS_MANIFEST = `${WEB_ACTIONS_CONTRACT_DIRECTORY}/manifest.json`

function finding(code, path, message) {
  return { code, path, message }
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0
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

function resolveRepositoryPath(rootDirectory, value) {
  const absolutePath = resolve(rootDirectory, value)
  const fromRoot = relative(rootDirectory, absolutePath)
  if (fromRoot.startsWith(`..${sep}`) || fromRoot === "..") {
    return null
  }
  return absolutePath
}

function resolveFixturePath(rootDirectory, contractDirectory, value) {
  const normalized = value.replaceAll("\\", "/")
  const absolutePath = resolve(
    contractDirectory,
    normalized.startsWith("fixtures/") ? normalized : normalized,
  )
  const fromContracts = relative(contractDirectory, absolutePath)
  if (fromContracts.startsWith(`..${sep}`)) {
    return null
  }
  return absolutePath
}

function validateResultEnvelope(result, fixturePath, findings) {
  if (!isRecord(result)) {
    findings.push(
      finding("INVALID_RESULT", fixturePath, "Fixture result must be an object."),
    )
    return
  }

  if (result.success === true) {
    if ("message" in result) {
      findings.push(
        finding(
          "INVALID_SUCCESS_ENVELOPE",
          fixturePath,
          "Success results must not include message.",
        ),
      )
    }
    return
  }

  if (result.success === false) {
    if (!isNonEmptyString(result.message)) {
      findings.push(
        finding(
          "INVALID_FAILURE_ENVELOPE",
          fixturePath,
          "Failure results require a non-empty message string.",
        ),
      )
    }
    if ("data" in result) {
      findings.push(
        finding(
          "INVALID_FAILURE_ENVELOPE",
          fixturePath,
          "Failure results must not include data.",
        ),
      )
    }
    return
  }

  findings.push(
    finding(
      "INVALID_RESULT",
      fixturePath,
      "Result must include success true or false.",
    ),
  )
}

function hasExport(source, exportName) {
  return new RegExp(`export\\s+async\\s+function\\s+${exportName}\\b`).test(
    source,
  )
}

export function validateWebActionContracts(rootDirectory) {
  const findings = []
  const contractDirectory = resolve(rootDirectory, WEB_ACTIONS_CONTRACT_DIRECTORY)
  const manifestPath = resolve(rootDirectory, WEB_ACTIONS_MANIFEST)
  const manifest = readJson(manifestPath, findings, WEB_ACTIONS_MANIFEST)

  if (!manifest) {
    return { findings, actionCount: 0, fixtureCount: 0 }
  }

  const actions = Array.isArray(manifest.actions) ? manifest.actions : []
  const referencedFixtures = new Set()
  const actionIds = new Set()

  for (const action of actions) {
    if (!isRecord(action) || !isNonEmptyString(action.id)) {
      findings.push(
        finding("INVALID_ACTION", WEB_ACTIONS_MANIFEST, "Action id is required."),
      )
      continue
    }

    if (actionIds.has(action.id)) {
      findings.push(
        finding("DUPLICATE_ACTION", action.id, "Duplicate action id."),
      )
    }
    actionIds.add(action.id)

    const actionFilePath = resolveRepositoryPath(
      rootDirectory,
      action.actionFile,
    )
    if (!actionFilePath || !existsSync(actionFilePath)) {
      findings.push(
        finding("MISSING_ACTION_FILE", action.actionFile, "Action file not found."),
      )
      continue
    }

    const source = readFileSync(actionFilePath, "utf8")
    if (!hasExport(source, action.exportName)) {
      findings.push(
        finding(
          "MISSING_ACTION_EXPORT",
          action.actionFile,
          `Missing export ${action.exportName}.`,
        ),
      )
    }

    for (const consumer of action.webConsumers ?? []) {
      const consumerPath = resolveRepositoryPath(rootDirectory, consumer)
      if (!consumerPath || !existsSync(consumerPath)) {
        findings.push(
          finding("MISSING_CONSUMER", consumer, "Web consumer file not found."),
        )
      }
    }

    const fixturePaths = [
      action.successFixture,
      ...(action.errorFixtures ?? []),
    ].filter(Boolean)

    for (const fixtureRef of fixturePaths) {
      const fixturePath = resolveFixturePath(
        rootDirectory,
        contractDirectory,
        fixtureRef,
      )
      if (!fixturePath || !existsSync(fixturePath)) {
        findings.push(
          finding("MISSING_FIXTURE", fixtureRef, "Fixture file not found."),
        )
        continue
      }

      referencedFixtures.add(fixturePath)
      const fixture = readJson(fixturePath, findings, fixtureRef)
      if (!fixture) {
        continue
      }

      if (fixture.contractVersion !== manifest.contractVersion) {
        findings.push(
          finding(
            "FIXTURE_VERSION_MISMATCH",
            fixtureRef,
            "Fixture contractVersion must match manifest.",
          ),
        )
      }

      if (fixture.action !== action.id && fixture.action !== "*") {
        findings.push(
          finding(
            "FIXTURE_ACTION_MISMATCH",
            fixtureRef,
            `Fixture action ${fixture.action} does not match ${action.id}.`,
          ),
        )
      }

      validateResultEnvelope(fixture.result, fixtureRef, findings)
    }
  }

  const fixturesDirectory = resolve(contractDirectory, "fixtures")
  if (existsSync(fixturesDirectory)) {
    for (const file of readdirSync(fixturesDirectory)) {
      if (!file.endsWith(".json")) {
        continue
      }
      const absolute = resolve(fixturesDirectory, file)
      if (!referencedFixtures.has(absolute)) {
        findings.push(
          finding("ORPHAN_FIXTURE", file, "Fixture is not referenced by manifest."),
        )
      }
    }
  }

  return {
    findings,
    actionCount: actions.length,
    fixtureCount: referencedFixtures.size,
  }
}
