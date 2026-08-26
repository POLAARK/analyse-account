import assert from "node:assert/strict";
import test from "node:test";
import * as utilsBarrel from "../src/utils";

const deletedExports = [
  "fetchhttpJsonPuppeteer",
  "fetchhttpJsonPuppeteerTokenAnalysor",
  "fetchhttpJsonPuppeteerLoadNewPage",
  "fetchJsonFile",
  "fetchHttpJsonHandlingTooManyRequest",
  "makeDirectory",
  "writeFile",
  "isOccurenceInString",
  "fetchHttp",
  "BigIntDivisionForAmount",
] as const;

test("utils module no longer exports removed dead helpers", () => {
  for (const name of deletedExports) {
    assert.equal(
      (utilsBarrel as Record<string, unknown>)[name],
      undefined,
      `expected ${name} to be absent from src/utils barrel exports`,
    );
  }
});

test("surviving fetch utilities remain exported", () => {
  assert.equal(typeof utilsBarrel.fetchHttpJson, "function");
  assert.equal(typeof utilsBarrel.HttpResponseError, "function");
});
