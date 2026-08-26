import fs from "node:fs";
import { type ILogger } from "../logger";
import puppeteer, { Page } from "puppeteer";

export const fetchhttpJsonPuppeteer = async (
  url: string,
  jsonRequestUrl: string,
  logger: ILogger,
): Promise<any> => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  // Enable request interception
  await page.setRequestInterception(true);

  page.on("request", (request) => {
    request.continue();
  });
  // Listen for 'response' events
  page.on("response", async (response) => {
    const requestUrl = response.url();
    // const contentType = response.headers()['content-type'];

    // Check if the URL matches the desired pattern and the content type is JSON 'https://api.debank.com/history/list?user_addr='
    if (requestUrl.startsWith(jsonRequestUrl)) {
      try {
        const content = await response.json();
        return content;
      } catch (_err) {
        logger.info(" Pref light request Erreur ");
      }
    }
  });

  // Navigate to the target URL
  await page.goto(url);
  new Promise((r) => setTimeout(r, 10000));
  // Close the browser
  // await browser.close();
};

export const fetchhttpJsonPuppeteerTokenAnalysor = async (
  url: string,
  jsonRequestUrl: string,
  logger: ILogger,
  page: Page,
): Promise<any> => {
  await page.setRequestInterception(true);

  // Listen for 'response' events
  page.on("response", async (response) => {
    const requestUrl = response.url();
    // const contentType = response.headers()['content-type'];

    // Check if the URL matches the desired pattern and the content type is JSON 'https://api.debank.com/history/list?user_addr='
    if (requestUrl.startsWith(jsonRequestUrl)) {
      try {
        const content = await response.json();
        return content;
      } catch (_err) {
        logger.info(" Pref light request Erreur ");
      }
    }
  });

  // Navigate to the target URL
  await page.goto(url);
  new Promise((r) => setTimeout(r, 20000));
  // Close the browser
  // await browser.close();
};

export const fetchhttpJsonPuppeteerLoadNewPage = async (
  url: string,
  jsonRequestUrl: string,
  logger: ILogger,
): Promise<any> => {
  // Launch the browser
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Enable request interception
  await page.setRequestInterception(true);

  // Listen for 'response' events
  page.on("response", async (response) => {
    const requestUrl = response.url();
    // const contentType = response.headers()['content-type'];

    // Check if the URL matches the desired pattern and the content type is JSON 'https://api.debank.com/history/list?user_addr='
    if (requestUrl.startsWith(jsonRequestUrl)) {
      try {
        const content = await response.json();
        return content;
      } catch (_err) {
        logger.info(" Pref light request Erreur ");
      }
    }
  });

  // Navigate to the target URL
  await page.goto(url);
  new Promise((r) => setTimeout(r, 20000));
  // Close the browser
  // await browser.close();
};

export const fetchJsonFile = (path: string): any => {
  const contentFile = fs.readFileSync(path, "utf-8");
  const jsonParse = JSON.parse(contentFile);

  return jsonParse;
};

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

export const fetchHttpJsonHandlingTooManyRequest = async (
  url: string,
  count: number = 0,
  header = {},
  logger: ILogger,
): Promise<any> => {
  let body: unknown;
  const response = await fetch(url, header);
  let counter: number = count;
  if (response.statusText === "Too Many Requests") {
    while (counter < 10) {
      counter += 1;
      await new Promise((resolve) => setTimeout(resolve, 60000));
      return fetchHttpJsonHandlingTooManyRequest(url, counter, {}, logger);
    }
    return { message: "Too Many Requests" };
  }
  try {
    body = await response.json();
  } catch (_err) {
    logger.info(`HTTP response returned invalid JSON (${response.status})`);
    throw new Error("HTTP response returned invalid JSON");
  }
  return body;
};

export const makeDirectory = (path: string): void => {
  if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true });
};

export const writeFile = (path: string, data: string): void => {
  fs.writeFile(path, data, (err) => {
    if (err) {
      console.error("Failed to write output file");
      return;
    }
  });
};

export const isOccurenceInString = function isString(
  firstString: string,
  secondString: string[] | string,
) {
  if (typeof secondString === "string") {
    return firstString.toLowerCase().includes(secondString.toLowerCase());
  } else {
    for (const str of secondString) {
      if (firstString.toLowerCase().includes(str.toLowerCase())) {
        return true;
      }
    }
    return false;
  }
};
