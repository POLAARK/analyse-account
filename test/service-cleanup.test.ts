import assert from "node:assert/strict";
import test from "node:test";
import type { BlockchainTransaction } from "../src/blockchainProvider/BlockchainTypes";
import { EtherscanApiService } from "../src/blockchainProvider/EtherscanApiService";
import type { ILogger } from "../src/logger/ILogger";
import { TransactionService } from "../src/transaction/TransactionService";
import type { TransferTransaction } from "../src/transaction/transaction.entity";

const logger: ILogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
};

test("merges Etherscan histories chronologically and keeps the first hash occurrence", async () => {
  const duplicateNormalTransaction = transaction("duplicate", "20", "normal");
  const service = new StubEtherscanApiService(
    [duplicateNormalTransaction, transaction("latest", "30")],
    [transaction("earliest", "10"), transaction("duplicate", "20", "internal")],
  );

  const history = await service.constructGlobalTransactionHistory("0x123", 0);

  assert.deepEqual(
    history.map(({ hash, type }) => ({ hash, type })),
    [
      { hash: "earliest", type: undefined },
      { hash: "duplicate", type: "normal" },
      { hash: "latest", type: undefined },
    ],
  );
});

test("aggregates equivalent transfers without mutating the input amounts", () => {
  const service = new TransactionService(
    null as never,
    null as never,
    logger,
    null as never,
    null as never,
  );
  const transfers: TransferTransaction[] = [transfer(1), transfer(2)];

  const aggregatedTransfers = service.aggregateTransferTransactions(transfers);

  assert.equal(aggregatedTransfers.length, 1);
  assert.equal(aggregatedTransfers[0].amount, 3);
  assert.deepEqual(
    transfers.map(({ amount }) => amount),
    [1, 2],
  );
});

class StubEtherscanApiService extends EtherscanApiService {
  constructor(
    private readonly normalTransactions: BlockchainTransaction[],
    private readonly internalTransactions: BlockchainTransaction[],
  ) {
    super(logger);
  }

  override async getNormalTransactions(): Promise<BlockchainTransaction[]> {
    return this.normalTransactions;
  }

  override async getInternalTransactions(): Promise<BlockchainTransaction[]> {
    return this.internalTransactions;
  }
}

function transaction(hash: string, timeStamp: string, type?: string): BlockchainTransaction {
  return {
    blockNumber: "1",
    timeStamp,
    hash,
    from: "0xfrom",
    to: "0xto",
    value: "0",
    contractAddress: "",
    input: "0x",
    type,
    gas: "21000",
  };
}

function transfer(amount: number): TransferTransaction {
  return {
    blockNumber: 1,
    timestamp: 1,
    tokenAdress: "0xtoken",
    amount,
    from: "0xfrom",
    to: "0xto",
    symbol: "TOKEN",
    status: "IN",
  };
}
