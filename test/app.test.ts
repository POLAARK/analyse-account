import assert from "node:assert/strict";
import test from "node:test";
import { main } from "../src/app";

test("rejects an invalid CLI wallet before configuration or database work", async () => {
  await assert.rejects(() => main(["not-an-address"]), /valid EVM address/);
});
