export class CoachServiceError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status = 400) {
    super(message)
    this.name = "CoachServiceError"
    this.code = code
    this.status = status
  }
}
