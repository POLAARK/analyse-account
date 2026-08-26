import assert from "node:assert/strict";
import test from "node:test";
import { unixMillisecondsToSeconds } from "../src/utils/time";

test("converts Unix milliseconds to whole Unix seconds", () => {
  assert.equal(unixMillisecondsToSeconds(1_700_000_000_999), 1_700_000_000);
});

test("rejects non-finite timestamps", () => {
  assert.throws(() => unixMillisecondsToSeconds(Number.NaN), /must be finite/);
});
