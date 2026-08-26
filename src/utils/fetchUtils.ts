import { type ILogger } from "../logger";

export const fetchHttp = async (url: string, header = {}): Promise<string> => {
  const response = await fetch(url, header);
  const body = await response.text();

  return body;
};

export const fetchHttpJson = async <T = unknown>(
  url: string,
  header = {},
  logger: ILogger,
): Promise<T> => {
  let body: unknown;
  const response = await fetch(url, header);

  if (!response.ok) {
    logger.info(`HTTP request failed (${response.status})`);
    throw new HttpResponseError(response.status);
  }

  try {
    body = await response.json();
  } catch (_err) {
    logger.info(`HTTP response returned invalid JSON (${response.status})`);
    throw new Error("HTTP response returned invalid JSON");
  }
  return body as T;
};

export class HttpResponseError extends Error {
  constructor(readonly statusCode: number) {
    super(`HTTP request failed with status ${statusCode}`);
    this.name = "HttpResponseError";
  }
}
