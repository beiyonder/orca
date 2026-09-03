export class PostgresProcessObligationError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'PostgresProcessObligationError'
    this.code = code
  }
}

export function failProcessObligation(code: string, message: string): never {
  throw new PostgresProcessObligationError(code, message)
}
