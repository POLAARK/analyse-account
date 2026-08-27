import { type IBlockchainScanApiService } from "../blockchainProvider";
import { ERROR_SAVING_ENTITY_IN_DATABASE } from "../constants/errors";
import { CustomError } from "../error/customError";
import { inject, injectable } from "inversify";
import SERVICE_IDENTIFIER from "../ioc_container/identifiers";
import { type IJsonRpcProviderManager } from "../jsonRpcProvider";
import { type ILogger } from "../logger";
import { Transaction } from "../transaction/Transaction";
import { Wallet } from "../wallet/Wallet";
import { type BlockchainTransaction } from "../blockchainProvider/BlockchainTypes";
import { type IWalletRepository } from "../wallet";
import { type ITransactionRepository } from "../transaction";

@injectable()
export class TransactionStreamerService {
  walletList: Set<string> | undefined;
  constructor(
    @inject(SERVICE_IDENTIFIER.EtherscanApiService)
    private readonly etherscanApiService: IBlockchainScanApiService,
    @inject(SERVICE_IDENTIFIER.Logger) private readonly logger: ILogger,
    @inject(SERVICE_IDENTIFIER.JsonRpcProviderManager)
    private readonly jsonRpcProviderManager: IJsonRpcProviderManager,
    @inject(SERVICE_IDENTIFIER.WalletRepository)
    private readonly walletRepository: IWalletRepository,
    @inject(SERVICE_IDENTIFIER.TransactionRepository)
    private readonly transactionRepository: ITransactionRepository,
  ) {}

  /**
   * Wallet list setter
   *
   * @param walletList
   */
  setWalletList(walletList: string[]) {
    this.walletList = new Set(walletList);
  }

  /**
   * Wallet list getter
   *
   * @returns walletList
   */
  getWalletList() {
    if (this.walletList) {
      return this.walletList;
    }
    throw new CustomError("WALLET_LIST_UNDEFINED", "Wallet list is undefined");
  }

  async buildWalletTransactionHistory(lastBlock?: number, startBlock: number = 0) {
    if (!this.walletList) throw new CustomError("Init wallet list before usage");
    // TODO, we should get lastBlock by transaction
    const latest = lastBlock
      ? lastBlock
      : await this.jsonRpcProviderManager.callProviderMethod<number>("getBlockNumber", []);
    for (const walletAddress of this.walletList) {
      try {
        // Check if the file exists and read the last updated block
        let wallet: Wallet | null = null;
        try {
          wallet = await this.walletRepository.findOneBy({ address: walletAddress });
        } catch {
          this.logger.error("Failed to load wallet transaction state");
        }
        const constStartBlock = wallet ? wallet.lastBlockUpdated + 1 : startBlock;
        if (!wallet) {
          wallet = await this.walletRepository.save({
            address: walletAddress,
            lastBlockUpdated: 0,
            transactions: [],
            numberOfTokensTraded: 0,
            performanceUSD: 0n,
            numberOfTxs: 0,
            lastAnalysisTimestamp: 0,
            startAnalysisTimestamp: 0,
          } as unknown as Wallet);
        }

        const history = await this.etherscanApiService.constructGlobalTransactionHistory(
          walletAddress,
          constStartBlock,
          latest,
        );

        // Persist transactions first: the wallet cursor may only advance once the
        // history is durably saved, otherwise a failed write would skip those blocks.
        await this.saveHistoryToDB(history, wallet);
        wallet.lastBlockUpdated = latest;
        await this.walletRepository.save(wallet);
      } catch (error) {
        this.logger.error("Failed to build wallet transaction history");
        throw new CustomError(
          "Error building wallet transaction history",
          `Failed to ingest transaction history for wallet ${walletAddress}`,
          error,
        );
      }
    }
  }

  async saveHistoryToDB(history: BlockchainTransaction[], wallet: Wallet) {
    try {
      for (const tx of history) {
        const transaction = new Transaction();
        transaction.hash = tx.hash;
        transaction.wallet = wallet;
        transaction.blockNumber = parseEtherscanInteger(tx.blockNumber, "blockNumber");
        transaction.timeStamp = parseEtherscanInteger(tx.timeStamp, "timeStamp");
        transaction.fromAddress = tx.from;
        transaction.toAddress = tx.to;
        transaction.value = tx.value.toString();
        transaction.gas = parseEtherscanInteger(tx.gas, "gas");
        transaction.input = tx.input;
        transaction.contractAddress = tx.contractAddress;

        await this.transactionRepository.save(transaction);
      }
    } catch (error) {
      this.logger.error("Failed to save transaction history");
      throw new CustomError(
        ERROR_SAVING_ENTITY_IN_DATABASE,
        "Couldn't save transaction in to db",
        error,
      );
    }
  }

  addWallets(walletList: string[]) {
    if (!this.walletList) throw new CustomError("Init wallet list before usage");
    for (const walletAddress of walletList) {
      if (this.walletList.has(walletAddress)) {
        throw new Error(
          `Account already in list, here is the list ${Array.from(this.walletList).toString()}`,
        );
      } else {
        this.walletList.add(walletAddress);
      }
    }
  }
}

function parseEtherscanInteger(value: string, fieldName: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`Etherscan returned an invalid ${fieldName}`);
  }
  const parsedValue = Number(value);
  if (!Number.isSafeInteger(parsedValue)) {
    throw new Error(`Etherscan returned an unsafe ${fieldName}`);
  }
  return parsedValue;
}
