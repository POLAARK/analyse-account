import winston from "winston";

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

export const logger = winston.createLogger({
  level: "error",
  format: formatDEV,
  transports: [new winston.transports.Console()],
});
