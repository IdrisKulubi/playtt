export function getPublicVersionInfo(commitSha: string | undefined) {
  const commit = commitSha?.trim()

  return {
    commit: commit ? commit.slice(0, 7) : "local",
    appleSignInRoute: "/api/apple/sign-in",
  }
}
