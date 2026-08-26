import assert from "node:assert/strict";
import test from "node:test";
import { ethers, type TransactionReceipt } from "ethers";
import type { IJsonRpcProviderManager } from "../src/jsonRpcProvider/IJsonRpcProviderManager";
import type { ILogger } from "../src/logger/ILogger";
import type { ITokenService } from "../src/token/ITokenService";
import { Transaction } from "../src/transaction/Transaction";
import { TransactionService } from "../src/transaction/TransactionService";
import type { TransferTransaction } from "../src/transaction/transaction.entity";
import { formatUnitsToFixed } from "../src/utils/tokenUnits";

const logger: ILogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
};

test("formatUnitsToFixed converts known amounts exactly", () => {
  // 18 decimals: 10**24 raw wei-scale units -> exactly 1000000 tokens.
  assert.equal(formatUnitsToFixed("1000000000000000000000000", 18, 0), "1000000");
  assert.equal(formatUnitsToFixed("1000000000000000000000000", 18, 3), "1000000.000");
  // USDC-style 6 decimals.
  assert.equal(formatUnitsToFixed("1234567", 6, 6), "1.234567");
  // Truncated display keeps 3 fraction digits without float math.
  assert.equal(formatUnitsToFixed("1234567", 6, 3), "1.234");
});

test("formatUnitsToFixed rounds down (truncates) sub-unit dust", () => {
  // 999 units @ 6 decimals = 0.000999; displayed with 3 digits must be 0.000,
  // never rounded up to 0.001, so reported amounts cannot overstate holdings.
  assert.equal(formatUnitsToFixed("999", 6, 3), "0.000");
  // 4.5999 @ 4 decimals shown with 2 digits -> 4.59, not 4.60.
  assert.equal(formatUnitsToFixed("45999", 4, 2), "4.59");
  assert.equal(formatUnitsToFixed("1", 6, 0), "0");
  assert.equal(formatUnitsToFixed("0", 18, 3), "0.000");
});

test("formatUnitsToFixed stays exact beyond IEEE-754 magnitude", () => {
  // 30 digits: far beyond the safe integer range; floats would lose precision.
  assert.equal(formatUnitsToFixed("123456789012345678901234567890", 18, 3), "123456789012.345");
});

test("formatUnitsToFixed rejects malformed raw strings and options", () => {
  assert.throws(() => formatUnitsToFixed("", 18, 3), RangeError);
  assert.throws(() => formatUnitsToFixed("-1", 18, 3), RangeError);
  assert.throws(() => formatUnitsToFixed("12.5", 18, 3), RangeError);
  assert.throws(() => formatUnitsToFixed("1e18", 18, 3), RangeError);
  assert.throws(() => formatUnitsToFixed("1", -1, 3), RangeError);
  assert.throws(() => formatUnitsToFixed("1", 18, Number.NaN), RangeError);
});
test("formatUnitsToFixed roundtrips with floor(raw / 10**decimals)", () => {
  // Deterministic LCG keeps the test hermetic and reproducible.
  let state = 0x9e3779b9 | 0;
  const nextUint32 = () => {
    state = (Math.imul(1103515245, state) + 12345) | 0;
    return state >>> 0;
  };

  for (let iteration = 0; iteration < 200; iteration++) {
    const digitCount = 1 + (nextUint32() % 64);
    let rawText = String.fromCharCode(49 + (nextUint32() % 9));
    for (let index = 1; index < digitCount; index++) {
      rawText += String(nextUint32() % 10);
    }
    const raw = BigInt(rawText);
    const decimals = nextUint32() % 37;

    const formattedInteger = formatUnitsToFixed(rawText, decimals, 0);
    const integerPart = BigInt(formattedInteger);

    // Integer part is exactly floor(raw / 10**decimals) ...
    assert.equal(integerPart, raw / 10n ** BigInt(decimals), `raw=${rawText} decimals=${decimals}`);
    // ... and scaling it back reproduces raw with its sub-unit dust removed.
    const unit = 10n ** BigInt(decimals);
    assert.equal(integerPart * unit, raw - (raw % unit), `raw=${rawText} decimals=${decimals}`);
  }

  // Fixed spot check at extreme magnitude (80 digits).
  const huge = `${"9".repeat(40)}${"7".repeat(40)}`;
  const formatted = formatUnitsToFixed(huge, 31, 0);
  assert.equal(BigInt(formatted) * 10n ** 31n, BigInt(huge) - (BigInt(huge) % 10n ** 31n));
});

function service(): TransactionService {
  return new TransactionService(null as never, null as never, logger, null as never, null as never);
}

const WALLET_ADDRESS = "0x1111111111111111111111111111111111111111";
const COUNTERPARTY_ADDRESS = "0x2222222222222222222222222222222222222222";
const USDC_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

function transactionWith(value: string): Transaction {
  return {
    blockNumber: 1234,
    timeStamp: "1700000000",
    hash: `0x${"ab".repeat(32)}`,
    date: "2023-11-14",
    from: WALLET_ADDRESS,
    to: COUNTERPARTY_ADDRESS,
    value,
  } as unknown as Transaction;
}

function receiptWith(from: string, to: string, logs: unknown[]): TransactionReceipt {
  return { from, to, logs } as unknown as TransactionReceipt;
}

test("native-value transfer summary carries raw amount and 18 decimals losslessly", () => {
  const summary: TransferTransaction[] = [];
  const rawWei = "123456789012345678901234";

  service().addTransferTransactionIfValue(
    transactionWith(rawWei),
    summary,
    receiptWith(WALLET_ADDRESS, COUNTERPARTY_ADDRESS, []),
  );

  assert.equal(summary.length, 1);
  assert.equal(summary[0].amountRaw, rawWei);
  assert.equal(summary[0].tokenDecimals, 18);
  assert.equal(summary[0].amount, 123456.789);
  assert.equal(summary[0].symbol, "WETH");
  assert.equal(summary[0].status, "OUT");
  assert.equal(summary[0].blockNumber, 1234);
  assert.equal(summary[0].timestamp, 1700000000);
});

test("native-value zero-transfer produces no summary entry", () => {
  const summary: TransferTransaction[] = [];

  service().addTransferTransactionIfValue(
    transactionWith("0"),
    summary,
    receiptWith(WALLET_ADDRESS, COUNTERPARTY_ADDRESS, []),
  );

  assert.deepEqual(summary, []);
});

const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");

function transferLog(tokenAddress: string, from: string, to: string, rawAmount: bigint) {
  return {
    address: tokenAddress,
    topics: [TRANSFER_TOPIC, ethers.zeroPadValue(from, 32), ethers.zeroPadValue(to, 32)],
    data: ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [rawAmount]),
  };
}

async function summarizeLogs(logs: unknown[]): Promise<TransferTransaction[]> {
  const receipt = receiptWith(WALLET_ADDRESS, COUNTERPARTY_ADDRESS, logs);
  const providerManager: IJsonRpcProviderManager = {
    callProviderMethod: <T>() => Promise.resolve(receipt) as Promise<T>,
    getCurrentProvider: () => ({}) as never,
  };
  const tokenService: ITokenService = {
    getTokenDetails: () => Promise.resolve({ tokenSymbol: "USDC", tokenDecimals: BigInt(6) }),
  };
  const logService = new TransactionService(
    providerManager,
    null as never,
    logger,
    tokenService,
    null as never,
  );
  return await logService.getTransactionTransferSummaryFromLog(
    transactionWith("0"),
    WALLET_ADDRESS,
  );
}

test("log-based transfer summary carries raw amount, token decimals, truncated amount", async () => {
  const transfers = await summarizeLogs([
    transferLog(USDC_ADDRESS, WALLET_ADDRESS, COUNTERPARTY_ADDRESS, 1234567n),
  ]);

  assert.equal(transfers.length, 1);
  assert.equal(transfers[0].amountRaw, "1234567");
  assert.equal(transfers[0].tokenDecimals, 6);
  assert.equal(transfers[0].amount, 1.234);
  assert.equal(transfers[0].symbol, "USDC");
  assert.equal(transfers[0].status, "OUT");
  assert.equal(transfers[0].tokenAdress, USDC_ADDRESS);
});

test("identical log-based transfers aggregate into one lossless entry", async () => {
  const transfers = await summarizeLogs([
    transferLog(USDC_ADDRESS, WALLET_ADDRESS, COUNTERPARTY_ADDRESS, 1234567n),
    transferLog(USDC_ADDRESS, WALLET_ADDRESS, COUNTERPARTY_ADDRESS, 1234567n),
  ]);

  assert.equal(transfers.length, 1);
  assert.equal(transfers[0].amountRaw, "2469134");
  assert.equal(transfers[0].tokenDecimals, 6);
  assert.equal(transfers[0].amount, 2.469);
});

test("mixed aggregation falls back to legacy float addition without NaN", () => {
  const transfers: TransferTransaction[] = [
    {
      blockNumber: 1,
      timestamp: 1,
      tokenAdress: "0xtoken",
      amount: 1.25,
      amountRaw: "1250000",
      tokenDecimals: 6,
      from: "0xfrom",
      to: "0xto",
      symbol: "TOKEN",
      status: "IN",
    },
    {
      blockNumber: 2,
      timestamp: 2,
      tokenAdress: "0xtoken",
      amount: 2.5,
      from: "0xfrom",
      to: "0xto",
      symbol: "TOKEN",
      status: "IN",
    },
  ];

  const aggregatedTransfers = service().aggregateTransferTransactions(transfers);

  assert.equal(aggregatedTransfers.length, 1);
  assert.equal(Number.isNaN(aggregatedTransfers[0].amount), false);
  assert.equal(aggregatedTransfers[0].amount, 3.75);
  assert.deepEqual(
    transfers.map(({ amount }) => amount),
    [1.25, 2.5],
  );
});
