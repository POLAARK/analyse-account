import { INTERNAL_SERVER_ERROR } from "../constants/errors";

export class CustomError extends Error {
  public type: string;
  public additionalInfo?: string;
  public baseError?: Error;
  constructor(type?: string, message = "Internal server error", baseError?: Error | unknown) {
    const msg = typeof message === "object" ? JSON.stringify(message) : message;
    super(msg);
    this.type = type || INTERNAL_SERVER_ERROR;
    this.additionalInfo =
      baseError instanceof Error ? baseError.message : JSON.stringify(baseError);
    this.baseError = baseError as Error;
    Error.captureStackTrace(this);
  }
  // TODO check if error type == CustomError if yes throw only this one
  checkIfCustomError(baseError: Error) {
    if (baseError instanceof CustomError) {
      return baseError;
    }
  }
}
