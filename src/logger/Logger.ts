import { injectable } from "inversify";
import winston, { Logger as WinstonLogger } from "winston";
import type { ILogger } from "./ILogger";

@injectable()
export class Logger implements ILogger {
  private logger: WinstonLogger;

  constructor() {
    const { combine, timestamp, json, errors, prettyPrint } = winston.format;

    const formatArr = [errors({ stack: true }), timestamp(), json(), prettyPrint()];
    this.logger = winston.createLogger({
      level: "info",
      format: combine(...formatArr),
      transports: [new winston.transports.Console()],
    });
  }

  info(message: string, meta?: unknown): void {
    this.logger.info(message, meta);
  }

  warn(message: string, meta?: unknown): void {
    this.logger.warn(message, meta);
  }

  error(message: string, meta?: unknown): void {
    this.logger.error(message, meta);
  }

  debug(message: string, meta?: unknown): void {
    this.logger.debug(message, meta);
  }
}
