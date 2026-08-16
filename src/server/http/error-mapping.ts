export type HttpErrorDetails = {
  code: string
  message: string
  status: number
}

type DomainHttpError = Error & HttpErrorDetails

export function mapDomainOrUnexpectedError<T extends DomainHttpError>(
  error: unknown,
  isDomainError: (input: unknown) => input is T,
  unexpected: Pick<HttpErrorDetails, "code" | "message">,
): HttpErrorDetails {
  if (isDomainError(error)) {
    return {
      code: error.code,
      message: error.message,
      status: error.status,
    }
  }

  return {
    code: unexpected.code,
    message: unexpected.message,
    status: 500,
  }
}
