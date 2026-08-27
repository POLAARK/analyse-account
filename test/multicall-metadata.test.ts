import assert from "node:assert/strict";
import test from "node:test";
import { AbiCoder, Interface, ethers } from "ethers";
import { MULTICALL3_ADDRESS, MULTICALL_BATCH_SIZE, multicall3 } from "../src/abis/multicall3";
import type { IJsonRpcProviderManager } from "../src/jsonRpcProvider/IJsonRpcProviderManager";
import type { ILogger } from "../src/logger/ILogger";
import type { ITokenRepository } from "../src/token/ITokenRepository";
import type { Token } from "../src/token/Token";
import { TokenService } from "../src/token/TokenService";
import { Transaction } from "../src/transaction/Transaction";
import { TransactionService } from "../src/transaction/TransactionService";
import type { TransferTransaction } from "../src/transaction/transaction.entity";

const logger: ILogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
};

const MULTICALL_INTERFACE = new Interface(multicall3);
const TOKEN_INTERFACE = new Interface([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
]);
const CODER = AbiCoder.defaultAbiCoder();

/** Deterministic lowercase ERC-20-style addresses, unique per index. */
function tokenAddress(index: number): string {
  return `0x${index.toString(16).padStart(4, "0").repeat(10)}`;
}

function ok(symbolOrDecimals: string | number): { success: boolean; returnData: string } {
  const isSymbol = typeof symbolOrDecimals === "string";
  return {
    success: true,
    returnData: isSymbol
      ? TOKEN_INTERFACE.encodeFunctionResult("symbol", [symbolOrDecimals])
      : TOKEN_INTERFACE.encodeFunctionResult("decimals", [symbolOrDecimals]),
  };
}

const failedResult = { success: false, returnData: "0x" };

interface ProviderManagerOptions {
  /** Ordered eth_call replies, one entry per aggregate3 request. */
  multicallReplies?: { success: boolean; returnData: string }[][];
  getCurrentProvider?: () => unknown;
}

function providerManager(options: ProviderManagerOptions = {}) {
  let replyIndex = 0;
  const multicallRequests: { to: string; data: string }[] = [];
  const manager: IJsonRpcProviderManager = {
    callProviderMethod<T>(methodName: string, args: unknown[]): Promise<T> {
      if (methodName === "call") {
        const txObject = args[0] as { to: string; data: string };
        assert.equal(txObject.to.toLowerCase(), MULTICALL3_ADDRESS.toLowerCase());
        assert.equal(args[1], "latest");
        multicallRequests.push(txObject);
        const reply = options.multicallReplies?.[replyIndex];
        replyIndex++;
        if (!reply) return Promise.reject(new Error("unexpected extra multicall request"));
        // Multicall3 answers every submitted Call3 with exactly one Result.
        return Promise.resolve(
          CODER.encode(["(bool,bytes)[]"], [reply.map((r) => [r.success, r.returnData])]),
        ) as Promise<T>;
      }
      throw new Error(`unexpected method ${methodName}`);
    },
    getCurrentProvider: (options.getCurrentProvider ?? (() => ({}))) as never,
  };
  return { manager, multicallRequests };
}

interface ServiceOptions extends ProviderManagerOptions {
  tokens?: Map<string, Token>;
}

function makeTokenService(options: ServiceOptions = {}) {
  const savedTokens: Token[] = [];
  const repoOverrides = options.tokens
    ? {
        findOneByAddress: async (address: string) =>
          options.tokens?.get(address.toLowerCase()) ?? null,
      }
    : {};
  const repository: ITokenRepository = {
    findOneBy: () => Promise.resolve(null),
    findOneByAddress: () => Promise.resolve(null),
    findAll: () => Promise.resolve([]),
    find: () => Promise.resolve([]),
    save: async (token: Token) => {
      savedTokens.push(token);
      return token;
    },
    delete: () => Promise.resolve(),
    ...repoOverrides,
  };
  const { manager, multicallRequests } = providerManager(options);
  return {
    service: new TokenService(repository, logger, manager),
    manager,
    multicallRequests,
    savedTokens,
  };
}

test("constants pin the canonical Multicall3 deployment and documented batch size", () => {
  assert.equal(MULTICALL3_ADDRESS, "0xcA11bde05977b3631167028862bE2a173976CA11");
  assert.equal(MULTICALL_BATCH_SIZE, 50);
});

test("one aggregate3 request resolves many tokens with correct values", async () => {
  const first = tokenAddress(1);
  const second = tokenAddress(2);
  const { service, multicallRequests } = makeTokenService({
    multicallReplies: [[ok("USDC"), ok(6), ok("WETH"), ok(18)]],
  });

  const details = await service.getTokenDetailsBatch([first, second]);

  assert.equal(multicallRequests.length, 1);

  // The encoded payload must carry one interleaved symbol/decimals pair per address.
  const decodedCalls = MULTICALL_INTERFACE.decodeFunctionData(
    "aggregate3",
    multicallRequests[0].data,
  )[0];
  assert.equal(decodedCalls.length, 4);
  assert.deepEqual(
    decodedCalls.map((call: { target: string }) => call.target.toLowerCase()),
    [first, first, second, second],
  );
  const selectors = new Set(
    decodedCalls.map((call: { callData: string }) => call.callData.slice(0, 10)),
  );
  assert.equal(selectors.size, 2); // symbol() vs decimals()

  assert.deepEqual(details.get(first), { tokenSymbol: "USDC", tokenDecimals: 6 });
  assert.deepEqual(details.get(second), { tokenSymbol: "WETH", tokenDecimals: 18 });
});

test("120 tokens are chunked into ceil(120/50) requests and fully decoded", async () => {
  const addresses = Array.from({ length: 120 }, (_, index) => tokenAddress(index + 10));
  const replies: { success: boolean; returnData: string }[][] = [];
  for (let start = 0; start < addresses.length; start += MULTICALL_BATCH_SIZE) {
    const chunkSize = Math.min(MULTICALL_BATCH_SIZE, addresses.length - start);
    const chunkResults: { success: boolean; returnData: string }[] = [];
    for (let slot = 0; slot < chunkSize; slot++) {
      const globalIndex = start + slot;
      chunkResults.push(ok(`TOK${globalIndex}`), ok((globalIndex % 18) + 1));
    }
    replies.push(chunkResults);
  }
  const { service, multicallRequests } = makeTokenService({ multicallReplies: replies });

  const details = await service.getTokenDetailsBatch(addresses);

  assert.equal(multicallRequests.length, 3); // ceil(120 / 50)
  for (const request of multicallRequests.slice(0, 2)) {
    assert.equal(MULTICALL_INTERFACE.decodeFunctionData("aggregate3", request.data)[0].length, 100);
  }
  assert.equal(
    MULTICALL_INTERFACE.decodeFunctionData("aggregate3", multicallRequests[2].data)[0].length,
    40,
  );
  assert.equal(details.size, 120);
  assert.deepEqual(details.get(addresses[0]), { tokenSymbol: "TOK0", tokenDecimals: 1 });
  assert.deepEqual(details.get(addresses[49]), { tokenSymbol: "TOK49", tokenDecimals: 14 });
  assert.deepEqual(details.get(addresses[50]), { tokenSymbol: "TOK50", tokenDecimals: 15 });
  assert.deepEqual(details.get(addresses[119]), { tokenSymbol: "TOK119", tokenDecimals: 12 });
});

test("failed subcalls fall back to the single-token path error defaults", async () => {
  const healthy = tokenAddress(21);
  const failing = tokenAddress(22);
  const { service, multicallRequests } = makeTokenService({
    multicallReplies: [[ok("LINK"), ok(18), failedResult, failedResult]],
  });

  const details = await service.getTokenDetailsBatch([healthy, failing]);

  assert.equal(multicallRequests.length, 1);
  assert.deepEqual(details.get(healthy), { tokenSymbol: "LINK", tokenDecimals: 18 });
  // The unusable stubbed provider makes the fallback Contract throw, landing on defaults.
  assert.deepEqual(details.get(failing), {
    tokenSymbol: "ERR_TOKEN_SYMBOL",
    tokenDecimals: 18,
  });
});

test("fallback through a callable contract persists ETH-named tokens via the shared writer", async () => {
  const healthy = tokenAddress(41);
  const reverting = tokenAddress(42);
  const savedTokens: Token[] = [];
  const repository: ITokenRepository = {
    findOneBy: () => Promise.resolve(null),
    findOneByAddress: () => Promise.resolve(null),
    findAll: () => Promise.resolve([]),
    find: () => Promise.resolve([]),
    save: async (token: Token) => {
      savedTokens.push(token);
      return token;
    },
    delete: () => Promise.resolve(),
  };
  const { manager, multicallRequests } = providerManager({
    multicallReplies: [[ok("SHIB"), ok(18), failedResult, failedResult]],
    getCurrentProvider: () => ({
      call: async ({ data }: { data: string }) => {
        if (data.startsWith(TOKEN_INTERFACE.encodeFunctionData("decimals").slice(0, 10))) {
          return CODER.encode(["uint8"], [9]);
        }
        if (data.startsWith(TOKEN_INTERFACE.encodeFunctionData("symbol").slice(0, 10))) {
          return CODER.encode(["string"], ["WETH"]);
        }
        throw new Error("unexpected selector");
      },
    }),
  });

  const service = new TokenService(repository, logger, manager);
  const details = await service.getTokenDetailsBatch([healthy, reverting]);

  assert.equal(multicallRequests.length, 1);
  assert.deepEqual(details.get(reverting), { tokenSymbol: "WETH", tokenDecimals: 9 });
  // The shared cache-write policy must survive refactoring onto the batch path.
  assert.deepEqual(savedTokens, [{ address: reverting, decimals: 9n, symbol: "WETH" }]);
});

test("duplicate and empty inputs are deduped; empty input issues no requests", async () => {
  const address = tokenAddress(31);
  const differentCase = `0x${address.slice(2).toUpperCase()}`;
  const { service, multicallRequests } = makeTokenService({
    multicallReplies: [[ok("DAI"), ok(18)]],
  });

  const emptyDetails = await service.getTokenDetailsBatch([]);
  assert.equal(emptyDetails.size, 0);
  assert.equal(multicallRequests.length, 0);

  const details = await service.getTokenDetailsBatch([address, differentCase, address, ""]);
  assert.equal(multicallRequests.length, 1);
  assert.equal(details.size, 1);
  assert.deepEqual(details.get(address), { tokenSymbol: "DAI", tokenDecimals: 18 });
});

test("cached tokens bypass the multicall payload and are never rewritten", async () => {
  const cached = tokenAddress(51);
  const freshUsd = tokenAddress(52);
  const freshOther = tokenAddress(53);
  const cachedRow: Token = { address: cached, decimals: 6n, symbol: "USDT" };
  const { service, multicallRequests, savedTokens } = makeTokenService({
    tokens: new Map([[cached, cachedRow]]),
    multicallReplies: [[ok("USDC"), ok(6), ok("MANGO"), ok(8)]],
  });

  const details = await service.getTokenDetailsBatch([cached, freshUsd, freshOther]);

  assert.equal(multicallRequests.length, 1);
  const targets = MULTICALL_INTERFACE.decodeFunctionData(
    "aggregate3",
    multicallRequests[0].data,
  )[0].map((call: { target: string }) => call.target.toLowerCase());
  assert.equal(targets.includes(cached), false);
  assert.deepEqual([...targets], [freshUsd, freshUsd, freshOther, freshOther]);

  assert.equal(details.size, 3);
  assert.deepEqual(details.get(cached), { tokenSymbol: "USDT", tokenDecimals: 6 });
  assert.equal(
    savedTokens.some((token) => token.address === cached),
    false,
  );
  assert.ok(savedTokens.find((token) => token.address === freshUsd)); // USD symbol kept
  assert.equal(
    savedTokens.some((token) => token.address === freshOther),
    false,
  ); // MANGO skipped
});

test("a rejected multicall degrades every address through the single-token path", async () => {
  const { service, multicallRequests } = makeTokenService({});
  const first = tokenAddress(61);
  const second = tokenAddress(62);

  const details = await service.getTokenDetailsBatch([first, second]);

  assert.equal(multicallRequests.length, 1);
  assert.deepEqual(details.get(first), {
    tokenSymbol: "ERR_TOKEN_SYMBOL",
    tokenDecimals: 18,
  });
  assert.deepEqual(details.get(second), {
    tokenSymbol: "ERR_TOKEN_SYMBOL",
    tokenDecimals: 18,
  });
});

// --- TransactionService integration -------------------------------------------------

const WALLET_ADDRESS = "0x1111111111111111111111111111111111111111";
const COUNTERPARTY_ADDRESS = "0x2222222222222222222222222222222222222222";
const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");

function transactionFixture(): Transaction {
  return {
    blockNumber: 1234,
    timeStamp: "1700000000",
    hash: `0x${"ab".repeat(32)}`,
    date: "2023-11-14",
    from: WALLET_ADDRESS,
    to: COUNTERPARTY_ADDRESS,
    value: "0",
  } as unknown as Transaction;
}

function transferLog(tokenAddress_: string, from: string, to: string, rawAmount: bigint) {
  return {
    address: tokenAddress_,
    topics: [TRANSFER_TOPIC, CODER.encode(["address"], [from]), CODER.encode(["address"], [to])],
    data: CODER.encode(["uint256"], [rawAmount]),
  };
}

test("TransactionService reads metadata from exactly one batch call per receipt", async () => {
  const usdc = tokenAddress(71);
  const mango = tokenAddress(72);
  const logs = [
    transferLog(usdc, WALLET_ADDRESS, COUNTERPARTY_ADDRESS, 1000000n),
    transferLog(usdc, WALLET_ADDRESS, COUNTERPARTY_ADDRESS, 234567n),
    transferLog(mango, COUNTERPARTY_ADDRESS, WALLET_ADDRESS, 500000000n),
  ];
  let batchCalls = 0;
  let legacyCalls = 0;
  const tokenService = {
    async getTokenDetails() {
      legacyCalls++;
      throw new Error("legacy path must be unused when batching is available");
    },
    async getTokenDetailsBatch(requested: string[]) {
      batchCalls++;
      assert.deepEqual(new Set(requested.map((a) => a.toLowerCase())), new Set([usdc, mango]));
      return new Map([
        [usdc, { tokenSymbol: "USDC", tokenDecimals: 6 }],
        [mango, { tokenSymbol: "MANGO", tokenDecimals: 8 }],
      ]);
    },
  };
  const receiptManager: IJsonRpcProviderManager = {
    callProviderMethod: <T>() => Promise.resolve({ logs, from: "", to: "" }) as Promise<T>,
    getCurrentProvider: () => ({}) as never,
  };

  const service = new TransactionService(
    receiptManager,
    null as never,
    logger,
    tokenService as never,
    null as never,
  );

  const summaries: TransferTransaction[] = await service.getTransactionTransferSummaryFromLog(
    transactionFixture(),
    WALLET_ADDRESS,
  );

  assert.equal(batchCalls, 1);
  assert.equal(legacyCalls, 0);
  assert.equal(summaries.length, 2);
  const usdcSummary = summaries.find((t) => t.tokenAdress === usdc);
  const mangoSummary = summaries.find((t) => t.tokenAdress === mango);
  assert.deepEqual(
    {
      symbol: usdcSummary?.symbol,
      decimals: usdcSummary?.tokenDecimals,
      raw: usdcSummary?.amountRaw,
    },
    { symbol: "USDC", decimals: 6, raw: "1234567" },
  );
  assert.equal(mangoSummary?.symbol, "MANGO");
  assert.equal(mangoSummary?.tokenDecimals, 8);
  assert.equal(mangoSummary?.status, "IN");
});

test("TransactionService without a batch-capable token service falls back gracefully", async () => {
  const usdc = tokenAddress(81);
  const logs = [transferLog(usdc, WALLET_ADDRESS, COUNTERPARTY_ADDRESS, 1234567n)];
  let legacyCalls = 0;
  const tokenService = {
    async getTokenDetails(requested: string) {
      legacyCalls++;
      assert.equal(requested, usdc);
      return { tokenSymbol: "USDC", tokenDecimals: BigInt(6) };
    },
  };
  const receiptManager: IJsonRpcProviderManager = {
    callProviderMethod: <T>() => Promise.resolve({ logs, from: "", to: "" }) as Promise<T>,
    getCurrentProvider: () => ({}) as never,
  };

  const service = new TransactionService(
    receiptManager,
    null as never,
    logger,
    tokenService as never,
    null as never,
  );

  const summaries: TransferTransaction[] = await service.getTransactionTransferSummaryFromLog(
    transactionFixture(),
    WALLET_ADDRESS,
  );

  assert.equal(legacyCalls, 1);
  assert.equal(summaries[0]?.symbol, "USDC");
  assert.equal(summaries[0]?.tokenDecimals, 6);
});
