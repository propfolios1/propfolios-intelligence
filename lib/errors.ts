/** A business-rule failure the caller can correct (HTTP 422), raised by services outside the request layer. */
export class DomainError extends Error {
  readonly status: number = 422;
  constructor(message: string, status?: number) {
    super(message);
    if (status) this.status = status;
  }
}
