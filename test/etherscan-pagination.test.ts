import assert from "node:assert/strict";
import test from "node:test";
import type { BlockchainTransaction } from "../src/blockchainProvider/BlockchainTypes";
import { EtherscanApiService } from "../src/blockchainProvider/EtherscanApiService";
import type { ILogger } from "../src/logger/ILogger";

const logger: ILogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
};

const ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

test("aggregates full pages and a short final page into one ascending array", async () => {
  const script = (page: number): BlockchainTransaction[] => {
    if (page === 1) return [transaction("a1", "1"), transaction("a2", "2"), transaction("a3", "3")];
    if (page === 2) return [transaction("b1", "4"), transaction("b2", "5"), transaction("b3", "6")];
    if (page === 3) return [transaction("c1", "7"), transaction("c2", "8"), transaction("c3", "9")];
    if (page === 4) return [transaction("d1", "10")];
    throw new Error(`unexpected page request ${page}`);
  };
  const service = new ScriptedEtherscanApiService(script, logger);

  const transactions = await service.getNormalTransactions(ADDRESS, 10, 20, 3);

  assert.deepEqual(
    transactions.map(({ hash }) => hash),
    ["a1", "a2", "a3", "b1", "b2", "b3", "c1", "c2", "c3", "d1"],
  );
  assert.deepEqual(service.requestedPages, [1, 2, 3, 4]);
});

test("stops after a single under-full page without requesting another page", async () => {
  const service = new ScriptedEtherscanApiService(() => [transaction("only", "1")], logger);

  const transactions = await service.getNormalTransactions(ADDRESS, 10, 20, 4);

  assert.equal(transactions.length, 1);
  assert.deepEqual(service.requestedPages, [1]);
});

test("throws possible truncation after exceeding MAX_PAGES of full pages", async () => {
  let requests = 0;
  let thrown: unknown;
  const service = new ScriptedEtherscanApiService(() => {
    requests += 1;
    return [transaction(`tx-${requests}`, String(requests))];
  }, logger);

  try {
    await service.getNormalTransactions(ADDRESS, 7, 42, 1);
  } catch (error) {
    thrown = error;
  }

  assert.ok(thrown instanceof Error);
  assert.match(thrown.message, /possible truncation/);
  assert.ok(thrown.message.includes(ADDRESS));
  assert.ok(thrown.message.includes("7"));
  assert.ok(thrown.message.includes("42"));
  assert.ok(!thrown.message.toLowerCase().includes("apikey"));
  assert.equal(requests, 500);
});

test("retries the rate-limited page only, then continues pagination", async () => {
  const pageAttempts = new Map<number, number>();
  const script = (page: number): BlockchainTransaction[] => {
    pageAttempts.set(page, (pageAttempts.get(page) ?? 0) + 1);
    if (page === 2 && pageAttempts.get(page) === 1) {
      throw new Error("request failed: rate limit reached");
    }
    if (page === 1)
      return [transaction("p1a", "1"), transaction("p1b", "2"), transaction("p1c", "3")];
    if (page === 2)
      return [transaction("p2a", "4"), transaction("p2b", "5"), transaction("p2c", "6")];
    return [transaction("final", "7")];
  };
  const service = new ScriptedEtherscanApiService(script, logger);

  const transactions = await service.getNormalTransactions(ADDRESS, 10, 20, 3);

  assert.deepEqual(
    transactions.map(({ hash }) => hash),
    ["p1a", "p1b", "p1c", "p2a", "p2b", "p2c", "final"],
  );
  assert.equal(pageAttempts.get(1), 1);
  assert.equal(pageAttempts.get(2), 2);
  assert.equal(pageAttempts.get(3), 1);
});

class ScriptedEtherscanApiService extends EtherscanApiService {
  readonly requestedPages: number[] = [];

  constructor(
    private readonly script: (page: number) => BlockchainTransaction[],
    logger: ILogger,
  ) {
    super(logger);
    process.env.ETHERSCAN_API_KEY = "stub-key-never-used-against-real-api";
    this.rateLimitDelayMs = 0;
  }

  protected override async fetchTransactionsPage(
    _action: "txlist" | "txlistinternal",
    _kind: "normal" | "internal",
    _address: string,
    _startBlock: number,
    _endBlock: number,
    _offset: number,
    page: number,
  ): Promise<BlockchainTransaction[]> {
    this.requestedPages.push(page);
    return this.script(page);
  }
}

function transaction(hash: string, timeStamp: string): BlockchainTransaction {
  return {
    blockNumber: "1",
    timeStamp,
    hash,
    from: "0xfrom",
    to: "0xto",
    value: "0",
    contractAddress: "",
    input: "0x",
    gas: "21000",
  };
}
