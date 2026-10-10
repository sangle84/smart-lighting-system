export class AppError extends Error {
  readonly code: string;
  readonly details: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details ?? null;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
