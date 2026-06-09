export class ApiError extends Error {
  status: number
  code?: string
  data: unknown

  constructor(input: {
    message: string
    status: number
    code?: string
    data?: unknown
  }) {
    super(input.message)
    this.name = "ApiError"
    this.status = input.status
    this.code = input.code
    this.data = input.data
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}
