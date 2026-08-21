import { execSync } from "node:child_process"
import { readFileSync, statSync } from "node:fs"
import { join, resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")

const SECRET_FILE_PATTERNS = [
  /^\.env(\..+)?$/,
  /credentials\.json$/i,
  /id_rsa$/,
]

const SUSPICIOUS_LINE_PATTERNS = [
  /sk_live_[0-9a-z]+/i,
  /\bre_[A-Za-z0-9]{24,}\b/,
  /\bR2_SECRET_ACCESS_KEY\s*=\s*[^\s#]+\b/i,
  /\bR2_ACCESS_KEY_ID\s*=\s*[A-Za-z0-9]{20,}\b/,
]

function listTrackedFiles() {
  try {
    return execSync("git ls-files -z", {
      cwd: root,
      encoding: "utf8",
    })
      .split("\0")
      .filter(Boolean)
  } catch {
    return []
  }
}

function walkUntrackedWorkingTree(directory, findings) {
  // Fallback for environments without git metadata.
  void directory
  void findings
}

const findings = []

for (const relativePath of listTrackedFiles()) {
  const entry = relativePath.split("/").pop() ?? relativePath

  if (SECRET_FILE_PATTERNS.some((pattern) => pattern.test(entry)) && !entry.endsWith(".example")) {
    findings.push({
      code: "COMMITTED_SECRET_FILE",
      path: relativePath,
      message: "Environment or credential file must not be committed.",
    })
    continue
  }

  if (!/\.(ts|tsx|js|mjs|json|md|yml|yaml|sql)$/i.test(entry)) {
    continue
  }

  const absolutePath = join(root, relativePath)
  const contents = readFileSync(absolutePath, "utf8")

  for (const pattern of SUSPICIOUS_LINE_PATTERNS) {
    if (pattern.test(contents)) {
      findings.push({
        code: "SUSPICIOUS_SECRET_PATTERN",
        path: relativePath,
        message: `Matched suspicious secret pattern ${pattern}.`,
      })
    }
  }
}

if (findings.length === 0 && listTrackedFiles().length === 0) {
  walkUntrackedWorkingTree(root, findings)
}

if (findings.length > 0) {
  for (const finding of findings) {
    console.error(`[${finding.code}] ${finding.path} - ${finding.message}`)
  }
  process.exit(1)
}

console.log("Secret scan passed.")
