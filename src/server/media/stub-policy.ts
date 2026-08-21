export function shouldAllowFakeMediaStore(input: {
  environment: string | undefined
  driver: string | undefined
}) {
  if (input.environment === "production") {
    return false
  }

  return input.driver !== "r2"
}

export function assertFakeMediaStoreAllowed(environment: string | undefined) {
  if (environment === "production") {
    throw new Error("Fake MediaStore is disabled in production.")
  }
}
