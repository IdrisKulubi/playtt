export class PlaySessionError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "PlaySessionError"
    this.code = code
  }
}
