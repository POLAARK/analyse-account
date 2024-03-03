import winston from "winston";

export const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
});

if (process.env.NODE_ENV !== "PRD") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}