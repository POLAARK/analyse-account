import winston from "winston";

const formatDEV = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp(),
  winston.format.printf(({ level, message, timestamp }) => {
    if (typeof message === "object") {
      message = JSON.stringify(message, null, 4);
    }
    return `${timestamp} ${level}: ${message}`;
  })
);

export const logger = winston.createLogger({
  level: "info",
  format: formatDEV,
  transports: [new winston.transports.Console()],
});
