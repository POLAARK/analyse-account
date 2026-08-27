import assert from "node:assert/strict";
import test from "node:test";
import type { QueryRunner } from "typeorm";
import { ConvertMoneyColumnsToDecimal1787789827578 } from "../src/migrations/1787789827578-ConvertMoneyColumnsToDecimal";
import type { IEthOhlcService } from "../src/ethOhlc/IEthOhlcService";
import type { ITokenHistoryRepository } from "../src/tokenHistory/ITokenHistoryRepository";
import type { ITransactionService } from "../src/transaction/ITransactionService";
import type { TransferTransaction } from "../src/transaction/transaction.entity";
import { TokenHistory as TokenHistoryEntity } from "../src/tokenHistory/TokenHistory";
import { TokenHistoryService } from "../src/tokenHistory/TokenHistoryService";
import type { ILogger } from "../src/logger/ILogger";
import {
  ColumnNumericTransformer,
  SCALE,
  decimalTextToScaledBigint,
  formatScaledBigintToDecimal,
  parseDecimalToScaledBigint,
  scaleZero,
} from "../src/utils/moneyScale";

test("SCALE is the single fixed-point precision", () => {
  assert.equal(SCALE, 18);
});

test("parse/format roundtrips losslessly at scale 0, 18 and 38", () => {
  const samples = [
    "0",
    "1",
    "123.45",
    "98765432109876543210.123456789",
    "99999999999999999999999999999.999999999999999999",
  ];
  for (const sample of samples) {
    for (const scale of [0, SCALE, 38]) {
      const scaled = parseDecimalToScaledBigint(sample, scale);
      // The formatted form must re-parse to the identical scaled bigint, and
      // be a second-image fixed point under its own canonical formatting.
      const firstPass = formatScaledBigintToDecimal(scaled, scale, scale);
      const reparsed = parseDecimalToScaledBigint(firstPass, scale);
      assert.equal(reparsed, scaled, `${sample} @ scale ${scale}`);
      assert.equal(formatScaledBigintToDecimal(reparsed, scale, scale), firstPass);
    }
  }
});

test("roundtrip preserves 30+ digit magnitude without float loss", () => {
  const huge = "123456789012345678901234567890.123456789";
  const scaled = parseDecimalToScaledBigint(huge, SCALE);
  assert.equal(scaled, BigInt("123456789012345678901234567890123456789000000000"));
  assert.equal(
    formatScaledBigintToDecimal(scaled, SCALE, SCALE),
    "123456789012345678901234567890.123456789000000000",
  );
});

test("parse truncates excess fraction digits instead of rounding up", () => {
  assert.equal(parseDecimalToScaledBigint("1.2345", 2), 123n);
  assert.equal(parseDecimalToScaledBigint("0.000001", 0), 0n);
});

test("format truncates to requested digits and pads below them", () => {
  const value = parseDecimalToScaledBigint("12.3405", SCALE);
  assert.equal(formatScaledBigintToDecimal(value, SCALE, 3), "12.340");
  assert.equal(formatScaledBigintToDecimal(value, SCALE, 20), "12.34050000000000000000");
  assert.equal(formatScaledBigintToDecimal(parseDecimalToScaledBigint("7", 18), 18, 0), "7");
  assert.equal(formatScaledBigintToDecimal(scaleZero(), SCALE, 4), "0.0000");
});

test("format renders negative scaled values produced by net OUT flows; parser rejects raw negatives", () => {
  const inflow = parseDecimalToScaledBigint("10", SCALE);
  const outflow = parseDecimalToScaledBigint("12.5", SCALE);
  assert.equal(inflow - outflow, -parseDecimalToScaledBigint("2.5", SCALE));
  assert.equal(
    formatScaledBigintToDecimal(inflow - outflow, SCALE, SCALE),
    "-2.500000000000000000",
  );
  assert.throws(() => parseDecimalToScaledBigint("-2.5", SCALE), RangeError);
});

test("parse rejects malformed input and invalid scales", () => {
  assert.throws(() => parseDecimalToScaledBigint("", SCALE), RangeError);
  assert.throws(() => parseDecimalToScaledBigint("1e18", SCALE), RangeError);
  assert.throws(() => parseDecimalToScaledBigint(".", SCALE), RangeError);
  assert.throws(() => parseDecimalToScaledBigint("1", -1), RangeError);
  assert.throws(() => formatScaledBigintToDecimal(1n, SCALE, -1), RangeError);
});

test("transformer maps representative decimal strings losslessly at scale 18", () => {
  const transformer = new ColumnNumericTransformer();
  const scaled = transformer.from("123.450000000000000000");
  assert.equal(scaled, 123450000000000000000n);
  assert.equal(transformer.to(scaled), "123.450000000000000000");

  // Unpadded driver output must resolve identically.
  assert.equal(transformer.from("123.45"), 123450000000000000000n);
  assert.equal(decimalTextToScaledBigint(123.45, SCALE), 123450000000000000000n);

  const zero = new ColumnNumericTransformer();
  assert.equal(zero.from("0.000000000000000000"), 0n);
  assert.equal(zero.to(0n), "0.000000000000000000");
  assert.equal(zero.from(null), null);
  assert.equal(zero.from(undefined), undefined);
  assert.equal(zero.to(null), null);
  assert.equal(zero.to(undefined), undefined);
});

class CapturingQueryRunner {
  readonly queries: string[] = [];

  async query(sql: string): Promise<unknown> {
    this.queries.push(sql);
    return [];
  }
}

const WALLET_COLUMN = "wallet` MODIFY COLUMN `performanceUSD`";
const TOKEN_HISTORY_COLUMNS = ["EthGained", "EthSpent", "USDSpent", "USDGained", "performanceUSD"];

async function capturedUpQueries(): Promise<string[]> {
  const queryRunner = new CapturingQueryRunner();
  await new ConvertMoneyColumnsToDecimal1787789827578().up(queryRunner as unknown as QueryRunner);
  return queryRunner.queries;
}

async function capturedDownQueries(): Promise<string[]> {
  const queryRunner = new CapturingQueryRunner();
  await new ConvertMoneyColumnsToDecimal1787789827578().down(queryRunner as unknown as QueryRunner);
  return queryRunner.queries;
}

test("migration exposes up/down migrations over real statements", async () => {
  const migration = new ConvertMoneyColumnsToDecimal1787789827578();
  assert.equal(typeof migration.up, "function");
  assert.equal(typeof migration.down, "function");

  const upQueries = await capturedUpQueries();
  assert.equal(upQueries.length, 1 + TOKEN_HISTORY_COLUMNS.length);
  for (const statement of upQueries) {
    assert.match(statement, /MODIFY COLUMN/);
    assert.ok(statement.includes("DECIMAL(38,18)"), statement);
  }
  assert.ok(upQueries.some((statement) => statement.includes(WALLET_COLUMN)));
  for (const column of TOKEN_HISTORY_COLUMNS) {
    assert.ok(
      upQueries.some(
        (statement) => statement.includes("`token_history`") && statement.includes(`\`${column}\``),
      ),
      column,
    );
  }

  const downQueries = await capturedDownQueries();
  assert.equal(downQueries.length, upQueries.length);
  for (const statement of downQueries) {
    assert.ok(statement.includes("FLOAT"), statement);
    assert.ok(!statement.includes("DECIMAL"), statement);
  }
});

const ETH_WEI = "1500000000000000000";

function ethTransfer(status: "IN" | "OUT"): TransferTransaction {
  return {
    blockNumber: 100,
    timestamp: 1_700_000_000,
    tokenAdress: "0xtoken",
    amount: 1.5,
    amountRaw: ETH_WEI,
    tokenDecimals: 18,
    from: "0xfrom",
    to: "0xto",
    symbol: "WETH",
    status,
  };
}

const logger: ILogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
};

function serviceHarness(options?: { ethToUsd?: number }) {
  const tokenHistory = new TokenHistoryEntity();
  Object.assign(tokenHistory, {
    tokenAddress: "0xtoken",
    walletAddress: "0xwallet",
    tokenSymbol: "TOKEN",
    EthGained: scaleZero(),
    EthSpent: scaleZero(),
    USDSpent: scaleZero(),
    USDGained: scaleZero(),
    numberOfTx: 0,
    lastTxBlock: 0,
    performanceUSD: scaleZero(),
    pair: "",
  });
  const savedEntities: TokenHistoryEntity[] = [];
  let savedMaxRetries = 0;
  const ethOhlcService: IEthOhlcService = {
    fetchDataWithParams: () => Promise.resolve({}),
    getEthOhlc: () => Promise.resolve(),
    getETHtoUSD: (_valueInETH: number, _timestamp: number) =>
      Promise.resolve(options?.ethToUsd ?? 2.5),
  };
  const transactionService = {
    findMainTokenTradedOnTransaction: (transferTxSummary: TransferTransaction[]) =>
      Promise.resolve({
        updatedTransferTransactionSummary: transferTxSummary,
        tokenHistory,
        tokenPath: transferTxSummary[0]?.status,
      }),
  } as unknown as ITransactionService;
  const repository = {
    saveOrUpdateTokenHistory: (entity: TokenHistoryEntity, maxRetries: number) => {
      savedMaxRetries = Math.max(savedMaxRetries, maxRetries);
      savedEntities.push(entity);
      return Promise.resolve(entity);
    },
    findAllByAddress: () => Promise.resolve([]),
  } as unknown as ITokenHistoryRepository;

  const service = new TokenHistoryService(logger, ethOhlcService, transactionService, repository);
  const runTransfers = (transfers: TransferTransaction[]) =>
    service.updateWalletTokenHistory({ transferTxSummary: transfers }, "0xwallet");

  return {
    tokenHistory,
    runTransfers,
    savedEntities,
    retryCountAfterSave: () => savedMaxRetries,
  };
}

test("ETH pair IN then OUT yields symmetric scaled-bigint deltas and exact zero net performance", async () => {
  const harness = serviceHarness();

  await harness.runTransfers([ethTransfer("IN")]);
  assert.equal(harness.tokenHistory.EthGained, BigInt(ETH_WEI));
  assert.equal(harness.tokenHistory.EthSpent, scaleZero());
  // Stubbed oracle reports a fixed 2.5 USD per event; the scaled representation
  // must capture it digit-exactly.
  const afterIn = harness.tokenHistory.performanceUSD;
  assert.equal(afterIn, 2_500_000_000_000_000_000n);

  await harness.runTransfers([ethTransfer("OUT")]);
  assert.equal(harness.tokenHistory.EthGained, BigInt(ETH_WEI));
  assert.equal(harness.tokenHistory.EthSpent, BigInt(ETH_WEI));
  assert.equal(harness.tokenHistory.performanceUSD, scaleZero());

  const savedPerformance = harness.savedEntities.map((entity) => entity.performanceUSD);
  assert.equal(savedPerformance.length, 2);
  assert.equal(savedPerformance[1] - afterIn, -afterIn);
  assert.equal(harness.retryCountAfterSave(), 3);
});

test("ETH pair falls back to legacy amount when amountRaw is absent", async () => {
  const harness = serviceHarness();
  const legacy = ethTransfer("IN");
  delete legacy.amountRaw;
  legacy.amount = 0.1;

  await harness.runTransfers([legacy]);

  // The legacy float amount's exact fixed-point image (0.1 as an IEEE-754
  // double) is what gets scaled here; this artifact is why callers must
  // prefer amountRaw. The accumulator still holds it digit-exactly.
  assert.equal(harness.tokenHistory.EthGained, 100_000_000_000_000_006n);
  assert.equal(harness.tokenHistory.performanceUSD, 2_500_000_000_000_000_000n);
});

test("USD pair accumulates pure bigint amounts across adds and subtracts", async () => {
  const harness = serviceHarness();

  const usdTransfer = (status: "IN" | "OUT"): TransferTransaction => ({
    blockNumber: 100,
    timestamp: 1_700_000_000,
    tokenAdress: "0xusdc",
    amount: 1.234567,
    amountRaw: "1234567",
    tokenDecimals: 6,
    from: "0xfrom",
    to: "0xto",
    symbol: "USDC",
    status,
  });

  await harness.runTransfers([usdTransfer("IN")]);
  assert.equal(harness.tokenHistory.USDGained, 1_234_567_000_000_000_000n);
  assert.equal(harness.tokenHistory.USDSpent, scaleZero());
  assert.equal(harness.tokenHistory.performanceUSD, 1_234_567_000_000_000_000n);

  await harness.runTransfers([usdTransfer("OUT")]);
  assert.equal(harness.tokenHistory.USDGained, 1_234_567_000_000_000_000n);
  assert.equal(harness.tokenHistory.USDSpent, 1_234_567_000_000_000_000n);
  assert.equal(harness.tokenHistory.performanceUSD, scaleZero());
});
