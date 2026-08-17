/**
 * @param {number} ms
 */
export function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * @param {unknown} error
 */
export function isRetryableDeviceError(error) {
  if (!error || typeof error !== "object") {
    return false
  }

  const code = "code" in error ? String(error.code) : ""
  const status = "status" in error ? Number(error.status) : 0

  if (code === "SEQUENCE_GAP") {
    return false
  }

  if (code === "NETWORK_ERROR") {
    return true
  }

  return status >= 500 || status === 429
}

/**
 * @param {unknown} body
 */
export function isDuplicateScoreSuccess(body) {
  return body?.data?.duplicate === true
}

/**
 * @template T
 * @param {(attempt: number) => Promise<T>} fn
 * @param {{ maxAttempts?: number, baseMs?: number, maxMs?: number }} [options]
 */
export async function withRetry(fn, options = {}) {
  const maxAttempts = options.maxAttempts ?? 5
  const baseMs = options.baseMs ?? 250
  const maxMs = options.maxMs ?? 5000

  /** @type {unknown} */
  let lastError

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn(attempt)
    } catch (error) {
      lastError = error

      if (!isRetryableDeviceError(error) || attempt === maxAttempts) {
        throw error
      }

      const delay = Math.min(baseMs * 2 ** (attempt - 1), maxMs)
      await sleep(delay)
    }
  }

  throw lastError
}
