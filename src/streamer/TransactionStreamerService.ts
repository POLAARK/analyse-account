import { IBlockchainScanApiService } from "blockchainProvider";
import { ERROR_SAVING_ENTITY_IN_DATABASE } from "constants/errors";
import { config } from "dotenv";
import { CustomError } from "error/customError";
import { inject, injectable } from "inversify";
import SERVICE_IDENTIFIER from "ioc_container/identifiers";
import { IJsonRpcProviderManager } from "jsonRpcProvider";
import { ILogger } from "logger";
import { Transaction } from "transaction/Transaction";
import { Wallet } from "wallet/Wallet";
import { BlockchainTransaction } from "../blockchainProvider/BlockchainTypes";
import { TokenHistoryService } from "../tokenHistory/TokenHistoryService";
import { IWalletRepository } from "wallet";
import { ITransactionRepository } from "transaction";

config({ path: "src/../.env" });
@injectable()
export class TransactionStreamerService {
  walletList: Set<string>;
  constructor(
    @inject(SERVICE_IDENTIFIER.EtherscanApiService)
    private readonly etherscanApiService: IBlockchainScanApiService,
    @inject(SERVICE_IDENTIFIER.Logger) private readonly logger: ILogger,
    @inject(SERVICE_IDENTIFIER.JsonRpcProviderManager)
    private readonly jsonRpcProviderManager: IJsonRpcProviderManager,
    @inject(SERVICE_IDENTIFIER.WalletRepository)
    private readonly walletRepository: IWalletRepository,
    @inject(SERVICE_IDENTIFIER.TransactionRepository)
    private readonly transactionRepository: ITransactionRepository
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
    try {
      // TODO, we should get lastBlock by transaction
      const latest = lastBlock
        ? lastBlock
        : await this.jsonRpcProviderManager.callProviderMethod<number>("getBlockNumber", []);
      let constStartBlock;
      for (let walletAddress of this.walletList) {
        // Check if the file exists and read the last updated block
        let wallet = new Wallet();
        try {
          wallet = await this.walletRepository.findOneBy({ address: walletAddress });
        } catch (err) {
          console.log("builtAccountTransactionHistory");
          console.log(err);
          if (err == "EntityMetadataNotFoundError") {
          }
        }
        if (!wallet) {
          wallet = await this.walletRepository.save({
            address: walletAddress,
            lastBlockUpdated: 0,
            transactions: [],
            numberOfTokensTraded: 0,
            performanceUSD: 0,
            numberOfTxs: 0,
            lastAnalysisTimestamp: 0,
            startAnalysisTimestamp: 0,
          } as Wallet);
          constStartBlock = startBlock;
        }

        constStartBlock = wallet.lastBlockUpdated + 1;

        const history = await this.etherscanApiService.constructGlobalTransactionHistory(
          walletAddress,
          constStartBlock,
          latest
        );

        wallet.lastBlockUpdated = latest;
        await this.walletRepository.save(wallet);
        await this.saveHistoryToDB(history, wallet);
      }
    } catch (error) {
      this.logger.error("ERROR IN builtAccountTransactionHistory");
      this.logger.error(error);
      throw error;
    }
  }

  async saveHistoryToDB(history: BlockchainTransaction[], wallet: Wallet) {
    try {
      let value: number;
      for (const tx of history) {
        if (tx.isError == "1") {
        }
        value = tx.value;
        const transaction = new Transaction();
        transaction.hash = tx.hash;
        transaction.wallet = wallet;
        transaction.blockNumber = tx.blockNumber;
        transaction.timeStamp = tx.timeStamp;
        transaction.fromAddress = tx.from;
        transaction.toAddress = tx.to;
        transaction.value = tx.value.toString();
        transaction.gas = tx.gas;
        transaction.input = tx.input;
        transaction.contractAddress = tx.contractAddress;

        await this.transactionRepository.save(transaction);
      }
    } catch (error) {
      this.logger.error(error);
      throw new CustomError(
        ERROR_SAVING_ENTITY_IN_DATABASE,
        "Couldn't save transaction in to db",
        error
      );
    }
  }

  addWallets(walletList: string[]) {
    for (let walletAddress of walletList) {
      if (this.walletList.has(walletAddress)) {
        throw new Error(
          "Account already in list, here is the list " + Array.from(this.walletList).toString()
        );
      } else {
        this.walletList.add(walletAddress);
      }
    }
  }
}
