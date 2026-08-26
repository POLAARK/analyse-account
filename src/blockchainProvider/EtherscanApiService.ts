import { inject, injectable } from "inversify";
import { isAddress, Network } from "ethers";
import { ConfigObject } from "../config/Config";
import SERVICE_IDENTIFIER from "../ioc_container/identifiers";
import type { ILogger } from "../logger/ILogger";
import { fetchHttpJson, HttpResponseError } from "../utils/fetchUtils";
import type { BlockchainTransaction, EtherscanHistory } from "./BlockchainTypes";
import type { IBlockchainScanApiService } from "./IBlockchainScanApiService";

const ETHERSCAN_ENDPOINT = "https://api.etherscan.io/v2/api";
const RATE_LIMIT_DELAY_MS = 15 * 60 * 1000;

type TransactionAction = "txlist" | "txlistinternal";
type TransactionKind = "normal" | "internal";

@injectable()
export class EtherscanApiService implements IBlockchainScanApiService {
  constructor(@inject(SERVICE_IDENTIFIER.Logger) private readonly logger: ILogger) {}

  async getNormalTransactions(
    address: string,
    startBlock: number,
    endBlock = 99_999_999,
    offset = 2_000,
  ): Promise<BlockchainTransaction[]> {
    return await this.getTransactions("txlist", "normal", address, startBlock, endBlock, offset);
  }

  async getInternalTransactions(
    address: string,
    startBlock: number,
    endBlock = 99_999_999,
    offset = 2_000,
  ): Promise<BlockchainTransaction[]> {
    return await this.getTransactions(
      "txlistinternal",
      "internal",
      address,
      startBlock,
      endBlock,
      offset,
    );
  }

  async constructGlobalTransactionHistory(
    address: string,
    startBlock: number,
    endBlock = 99_999_999,
    offset = 2_000,
  ): Promise<BlockchainTransaction[]> {
    const [normalTransactions, internalTransactions] = await Promise.all([
      this.getNormalTransactions(address, startBlock, endBlock, offset),
      this.getInternalTransactions(address, startBlock, endBlock, offset),
    ]);

    const transactionsByHash = new Map<string, BlockchainTransaction>();
    for (const transaction of [...normalTransactions, ...internalTransactions].sort(
      compareTransactionTimestamps,
    )) {
      if (!transactionsByHash.has(transaction.hash)) {
        transactionsByHash.set(transaction.hash, transaction);
      }
    }
    return [...transactionsByHash.values()];
  }

  private async getTransactions(
    action: TransactionAction,
    kind: TransactionKind,
    address: string,
    startBlock: number,
    endBlock: number,
    offset: number,
  ): Promise<BlockchainTransaction[]> {
    if (!isAddress(address)) {
      throw new Error("Wallet address must be a valid EVM address");
    }
    if (
      ![startBlock, endBlock, offset].every(Number.isSafeInteger) ||
      startBlock < 0 ||
      endBlock < startBlock
    ) {
      throw new Error("Etherscan block range and offset must be safe integers");
    }
    if (offset < 1) {
      throw new Error("Etherscan offset must be positive");
    }
    const apiKey = process.env.ETHERSCAN_API_KEY;
    if (!apiKey) {
      throw new Error("ETHERSCAN_API_KEY is required");
    }

    const requestUrl = new URL(ETHERSCAN_ENDPOINT);
    requestUrl.search = new URLSearchParams({
      chainid: getChainId(),
      module: "account",
      action,
      address,
      startblock: startBlock.toString(),
      endblock: endBlock.toString(),
      page: "1",
      offset: offset.toString(),
      sort: "asc",
      apikey: apiKey,
    }).toString();

    let response: unknown;
    try {
      response = await fetchHttpJson(requestUrl.href, {}, this.logger);
    } catch (error) {
      if (!isRateLimitError(error)) throw error;

      this.logger.error("Etherscan rate limit reached; retrying after delay");
      await delay(RATE_LIMIT_DELAY_MS);
      response = await fetchHttpJson(requestUrl.href, {}, this.logger);
    }

    if (!isEtherscanHistory(response)) {
      throw new Error(`Etherscan returned an invalid ${kind} transaction response`);
    }
    if (response.message === "No transactions found") {
      this.logger.info(`No ${kind} transactions found for this chain`);
      return [];
    }
    if (response.status !== "1" || response.message !== "OK") {
      this.logger.error(`Etherscan rejected ${kind} transaction request`);
      throw new Error(`Etherscan rejected ${kind} transaction request: ${response.message}`);
    }
    return response.result;
  }
}

function getChainId(): string {
  const network = new ConfigObject().rpcConfigs?.network;
  if (network === undefined) {
    throw new Error("RPC network is required for Etherscan requests");
  }
  return Network.from(network).chainId.toString();
}

function isEtherscanHistory(value: unknown): value is EtherscanHistory {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.status === "string" &&
    typeof candidate.message === "string" &&
    Array.isArray(candidate.result) &&
    candidate.result.every(isBlockchainTransaction)
  );
}

function isBlockchainTransaction(value: unknown): value is BlockchainTransaction {
  if (!value || typeof value !== "object") return false;
  const transaction = value as Record<string, unknown>;
  return [
    "blockNumber",
    "timeStamp",
    "hash",
    "from",
    "to",
    "value",
    "contractAddress",
    "input",
    "gas",
  ].every((field) => typeof transaction[field] === "string");
}

function isRateLimitError(error: unknown): boolean {
  return (
    (error instanceof HttpResponseError && error.statusCode === 429) ||
    (error instanceof Error && error.message.toLowerCase().includes("rate limit"))
  );
}

function compareTransactionTimestamps(
  first: BlockchainTransaction,
  second: BlockchainTransaction,
): number {
  const firstTimestamp = BigInt(first.timeStamp);
  const secondTimestamp = BigInt(second.timeStamp);
  return firstTimestamp < secondTimestamp ? -1 : firstTimestamp > secondTimestamp ? 1 : 0;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
