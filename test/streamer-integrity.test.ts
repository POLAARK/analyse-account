import assert from "node:assert/strict";
import test from "node:test";
import type { BlockchainTransaction } from "../src/blockchainProvider/BlockchainTypes";
import { EtherscanApiService } from "../src/blockchainProvider/EtherscanApiService";
import { CustomError } from "../src/error/customError";
import type { IJsonRpcProviderManager } from "../src/jsonRpcProvider/IJsonRpcProviderManager";
import type { ILogger } from "../src/logger/ILogger";
import type { ITransactionRepository } from "../src/transaction/ITransactionRepository";
import type { Transaction } from "../src/transaction/Transaction";
import { TransactionStreamerService } from "../src/streamer/TransactionStreamerService";
import type { IWalletRepository } from "../src/wallet/IWalletRepository";
import { Wallet } from "../src/wallet/Wallet";
import type { FindManyOptions, FindOptionsWhere } from "typeorm";

const logger: ILogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
};

test("keeps lastBlockUpdated unchanged when persisting history fails and rejects with a typed error", async () => {
  const wallet = walletAt("0xfail", 100);
  const setup = buildSetup([wallet], [[blockchainTransaction("0xcrash")]], {
    transactionSaveError: new Error("db unavailable"),
    latestBlock: 150,
  });
  setup.streamer.setWalletList(["0xfail"]);

  await assert.rejects(
    setup.streamer.buildWalletTransactionHistory(150),
    (error: unknown): boolean => {
      assert.ok(error instanceof CustomError);
      assert.match(error.message, /0xfail/);
      return true;
    },
  );

  assert.equal(wallet.lastBlockUpdated, 100);
  assert.equal(setup.walletRepository.savedWallets.length, 0);
});

test("persists history before saving the advanced cursor", async () => {
  const wallet = walletAt("0xok", 40);
  const setup = buildSetup(
    [wallet],
    [[blockchainTransaction("0xa"), blockchainTransaction("0xb")]],
    { latestBlock: 120 },
  );
  setup.streamer.setWalletList(["0xok"]);

  await setup.streamer.buildWalletTransactionHistory(120);

  assert.deepEqual(setup.events, ["transaction:0xa", "transaction:0xb", "wallet:0xok:120"]);
  assert.equal(wallet.lastBlockUpdated, 120);
  assert.equal(setup.transactionRepository.savedTransactions.length, 2);
  assert.equal(setup.transactionRepository.savedTransactions[1]?.value, "1000000000000000000");
  assert.equal(setup.walletRepository.savedWallets.length, 1);
});

test("resumes ingestion after the persisted cursor range", async () => {
  const wallet = walletAt("0xresume", 40);
  const setup = buildSetup(
    [wallet],
    [[blockchainTransaction("0xa")], [blockchainTransaction("0xb")]],
    { latestBlock: 130 },
  );
  setup.streamer.setWalletList(["0xresume"]);

  await setup.streamer.buildWalletTransactionHistory(120);
  await setup.streamer.buildWalletTransactionHistory(130);

  assert.deepEqual(
    setup.etherscanService.requests.map(({ startBlock, endBlock }) => ({ startBlock, endBlock })),
    [
      { startBlock: 41, endBlock: 120 },
      { startBlock: 121, endBlock: 130 },
    ],
  );
  assert.equal(wallet.lastBlockUpdated, 130);
});

test("rejects invalid and unsafe Etherscan integers without advancing the cursor", async () => {
  const cases = [
    { description: "non-numeric blockNumber", overrides: { blockNumber: "12abc" } },
    { description: "unsafe gas value", overrides: { gas: "9007199254740993" } },
  ];

  for (const testCase of cases) {
    const wallet = walletAt("0xparse", 7);
    const setup = buildSetup([wallet], [[blockchainTransaction("0xtamper", testCase.overrides)]], {
      latestBlock: 50,
    });
    setup.streamer.setWalletList(["0xparse"]);

    await assert.rejects(
      setup.streamer.buildWalletTransactionHistory(50),
      (error: unknown): boolean => {
        assert.ok(error instanceof CustomError);
        assert.match(error.message, /0xparse/);
        return true;
      },
      testCase.description,
    );

    assert.equal(wallet.lastBlockUpdated, 7, `${testCase.description}: cursor must not advance`);
    assert.equal(setup.walletRepository.savedWallets.length, 0);
  }
});

class StubEtherscanApiService extends EtherscanApiService {
  public requests: Array<{ address: string; startBlock: number; endBlock?: number }> = [];
  private readonly queuedHistories: BlockchainTransaction[][];

  constructor(histories: BlockchainTransaction[][]) {
    super(logger);
    this.queuedHistories = [...histories];
  }

  override async constructGlobalTransactionHistory(
    address: string,
    startBlock: number,
    endBlock?: number,
    _offset?: number,
  ): Promise<BlockchainTransaction[]> {
    this.requests.push({ address, startBlock, endBlock });
    return this.queuedHistories.shift() ?? [];
  }
}

class RecordingWalletRepository implements IWalletRepository {
  public readonly savedWallets: Wallet[] = [];

  constructor(
    private readonly existingByAddress: Map<string, Wallet>,
    private readonly events: string[],
  ) {}

  async findOneBy(whereOptions: FindOptionsWhere<Wallet>): Promise<Wallet | null> {
    const address = whereOptions.address;
    if (typeof address !== "string") return null;
    return this.existingByAddress.get(address) ?? null;
  }

  async findOneByAddress(address: string): Promise<Wallet | null> {
    return this.findOneBy({ address });
  }

  findAll(): Promise<Wallet[]> {
    return Promise.resolve(Array.from(this.existingByAddress.values()));
  }

  find(_whereOptions: FindManyOptions<Wallet>): Promise<Wallet[]> {
    return this.findAll();
  }

  save(wallet: Wallet): Promise<Wallet> {
    this.savedWallets.push(wallet);
    this.events.push(`wallet:${wallet.address}:${wallet.lastBlockUpdated}`);
    return Promise.resolve(wallet);
  }

  delete(_id: number): Promise<void> {
    return Promise.resolve();
  }
}

class RecordingTransactionRepository implements ITransactionRepository {
  public readonly savedTransactions: Transaction[] = [];

  constructor(
    private readonly events: string[],
    private readonly failOnSave?: Error,
  ) {}

  async save(transaction: Transaction): Promise<Transaction> {
    if (this.failOnSave) throw this.failOnSave;
    this.savedTransactions.push(transaction);
    this.events.push(`transaction:${transaction.hash}`);
    return transaction;
  }

  async findOneBy(_whereOptions: FindOptionsWhere<Transaction>): Promise<Transaction | null> {
    return null;
  }

  async findAll(): Promise<Transaction[]> {
    return [];
  }

  async find(_whereOptions: FindManyOptions<Transaction>): Promise<Transaction[]> {
    return [];
  }

  async delete(_id: number): Promise<void> {}

  async findTransactionsByTimestamp(
    _walletAddress: string,
    _timestamp: number,
  ): Promise<Transaction[]> {
    return [];
  }
}

interface SetupResult {
  streamer: TransactionStreamerService;
  etherscanService: StubEtherscanApiService;
  events: string[];
  walletRepository: RecordingWalletRepository;
  transactionRepository: RecordingTransactionRepository;
}

function buildSetup(
  existingWallets: Wallet[],
  histories: BlockchainTransaction[][],
  options?: { transactionSaveError?: Error; latestBlock?: number },
): SetupResult {
  const events: string[] = [];
  const etherscanService = new StubEtherscanApiService(histories);
  const walletRepository = new RecordingWalletRepository(
    new Map(existingWallets.map((wallet) => [wallet.address, wallet])),
    events,
  );
  const transactionRepository = new RecordingTransactionRepository(
    events,
    options?.transactionSaveError,
  );
  const streamer = new TransactionStreamerService(
    etherscanService,
    logger,
    blockNumberManager(options?.latestBlock ?? 0),
    walletRepository,
    transactionRepository,
  );
  return { streamer, etherscanService, events, walletRepository, transactionRepository };
}

function blockNumberManager(latestBlock: number): IJsonRpcProviderManager {
  return {
    async callProviderMethod<T>(
      methodName: string,
      _args: unknown[],
      _timeout?: number,
    ): Promise<T> {
      assert.equal(methodName, "getBlockNumber");
      return latestBlock as unknown as T;
    },
    getCurrentProvider(): never {
      throw new Error("getCurrentProvider must not be used by the streamer");
    },
  };
}

function walletAt(address: string, lastBlockUpdated: number): Wallet {
  const wallet = new Wallet();
  wallet.address = address;
  wallet.lastBlockUpdated = lastBlockUpdated;
  return wallet;
}

function blockchainTransaction(
  hash: string,
  overrides?: Partial<BlockchainTransaction>,
): BlockchainTransaction {
  return {
    blockNumber: "110",
    timeStamp: "1717000000",
    hash,
    from: "0xfrom",
    to: "0xto",
    value: "1000000000000000000",
    contractAddress: "",
    input: "0x",
    gas: "21000",
    ...overrides,
  };
}
