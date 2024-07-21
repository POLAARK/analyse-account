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
    // this.logger = createLogger({
    //   level: "info",
    //   format: format.combine(
    //     format.colorize(),
    //     format.timestamp(),
    //     format.printf(({ timestamp, level, message, ...meta }) => {
    //       return `${timestamp} [${level}]: ${message} ${
    //         meta && Object.keys(meta).length ? JSON.stringify(meta) : ""
    //       }`;
    //     })
    //   ),
    //   transports: [new transports.Console(), new transports.File({ filename: "logs/app.log" })],
    // });
  }

  info(message: any, meta?: any): void {
    this.logger.info(message, meta);
  }

  warn(message: any, meta?: any): void {
    this.logger.warn(message, meta);
  }

  error(message: any, meta?: any): void {
    this.logger.error(message, meta);
  }

  debug(message: any, meta?: any): void {
    this.logger.debug(message, meta);
  }
}
