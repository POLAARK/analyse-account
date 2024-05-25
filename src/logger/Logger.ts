import winston, { format } from "winston";
import { injectable } from "inversify";
import { createLogger, transports, Logger as WinstonLogger } from "winston";
import { ILogger } from "./ILogger";

const formatDEV = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp(),
  winston.format.printf(({ level, message, timestamp }) => {
    let formattedMessage = "";
    if (message instanceof Error) {
      // Format the message including the error message and stack trace
      formattedMessage += `Error Message: ${message.message}\n`;
      if (message.stack) {
        formattedMessage += `Stack Trace: ${message.stack}\n`;
      }

      // Optionally include other properties of the error object
      const errorProps = Object.getOwnPropertyNames(message).filter(
        (prop) => prop !== "message" && prop !== "stack"
      );
      if (errorProps.length > 0) {
        formattedMessage += `Additional Properties:\n`;
        errorProps.forEach((prop) => {
          formattedMessage += `${prop}: ${JSON.stringify(message[prop], null, 4)}\n`;
        });
      }
    } else if (typeof message === "object") {
      // Stringify if the message is a non-Error object
      formattedMessage = JSON.stringify(message, null, 4);
    } else {
      // Use the message as it is for other types
      formattedMessage = message;
    }
    return `${timestamp} ${level}: ${formattedMessage}`;
  })
);

@injectable()
export class Logger implements ILogger {
  private logger: WinstonLogger;

  constructor() {
    this.logger = createLogger({
      level: "info",
      format: format.combine(
        format.colorize(),
        format.timestamp(),
        format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${
            meta && Object.keys(meta).length ? JSON.stringify(meta) : ""
          }`;
        })
      ),
      transports: [new transports.Console(), new transports.File({ filename: "logs/app.log" })],
    });
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
