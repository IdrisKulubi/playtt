export function shouldAutoRunReplayStub(input: {
  environment: string | undefined
  flag: string | undefined
}) {
  return input.flag === "true" && input.environment !== "production"
}

export function assertReplayStubExecutionAllowed(environment: string | undefined) {
  if (environment === "production") {
    throw new Error("Replay stub execution is disabled in production.")
  }
}
