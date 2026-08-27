import { inject, injectable } from "inversify";
import SERVICE_IDENTIFIER from "../ioc_container/identifiers";
import { type ILogger } from "../logger";
import { type ITokenHistoryRepository, type ITokenHistoryService } from "../tokenHistory";
import { Transaction, type ITransactionService } from "../transaction";
import { type IWalletRepository } from "./IWalletRepository";
import { Wallet } from "./Wallet";
import { type IWalletService } from "./IWalletService";
import { CustomError } from "../error/customError";
import { scaleZero } from "../utils/moneyScale";

@injectable()
export class WalletService implements IWalletService {
  constructor(
    @inject(SERVICE_IDENTIFIER.TransactionService)
    private readonly transactionService: ITransactionService,
    @inject(SERVICE_IDENTIFIER.TokenHistoryService)
    private readonly tokenHistoryService: ITokenHistoryService,
    @inject(SERVICE_IDENTIFIER.Logger) private readonly logger: ILogger,
    @inject(SERVICE_IDENTIFIER.WalletRepository)
    private readonly walletRepository: IWalletRepository,
    @inject(SERVICE_IDENTIFIER.TokenHistoryRepository)
    private readonly tokenHistoryRepository: ITokenHistoryRepository,
  ) {}
  /**
   * Create wallet trading History
   * @param address
   * @param timestamp
   * @returns
   */
  async createWalletTradingHistory(
    address: string,
    timestamp: number,
    concurrent = true,
  ): Promise<void> {
    const processTransactions = concurrent
      ? this.processTransactionsConcurrently
      : this.processTransactionsIteratively;

    const transactions = await this.transactionService.getTransactionByTimestamp(
      address,
      timestamp,
    );

    try {
      await processTransactions.call(this, transactions, address);
      const wallet = await this.walletRepository.findOneByAddress(address);
      if (!wallet) {
        throw new CustomError("NO WALLET FOUND");
      }
      await this.updateWalletTimestamps(timestamp, wallet);
      await this.updateWalletSummary(wallet);
      await this.walletRepository.save(wallet);
    } catch {
      this.logger.error("Error in getAccountTradingHistory");
    }
  }

  async processTransactionsConcurrently(transactions: Transaction[], address: string) {
    const transactionPromises = transactions.map(async (transaction) => {
      try {
        const transactionSummary =
          await this.transactionService.getTransactionTransferSummaryFromLog(transaction, address);
        return this.tokenHistoryService.updateWalletTokenHistory(
          { transferTxSummary: [...transactionSummary] },
          address,
        );
      } catch {
        this.logger.error("Error during createTransactionTransferSummary");
      }
    });

    await Promise.all(transactionPromises);
  }

  async processTransactionsIteratively(transactions: Transaction[], address: string) {
    for (const transaction of transactions) {
      try {
        const transactionSummary =
          await this.transactionService.getTransactionTransferSummaryFromLog(transaction, address);
        await this.tokenHistoryService.updateWalletTokenHistory(
          { transferTxSummary: [...transactionSummary] },
          address,
        );
      } catch {
        this.logger.error("Error during createTransactionTransferSummary");
      }
    }
  }

  async updateWalletTimestamps(timestamp: number, wallet: Wallet): Promise<void> {
    if (wallet) {
      if (!wallet.startAnalysisTimestamp || wallet.startAnalysisTimestamp < timestamp) {
        wallet.startAnalysisTimestamp = timestamp;
      }
      wallet.lastAnalysisTimestamp = Math.floor(Date.now() / 1000);
    } else {
      throw new Error("Wallet not found");
    }
  }

  //TODOPB : To be modified
  async updateWalletSummary(wallet: Wallet): Promise<void> {
    try {
      const tokenHistories = await this.tokenHistoryRepository.findAllByAddress(wallet.address);
      wallet.numberOfTokensTraded = tokenHistories.length;
      wallet.numberOfTxs = tokenHistories.reduce(
        (total, tokenHistory) => total + tokenHistory.numberOfTx,
        0,
      );
      wallet.performanceUSD = tokenHistories.reduce(
        (total, tokenHistory) => total + tokenHistory.performanceUSD,
        scaleZero(),
      );
    } catch (_error) {
      throw new CustomError(
        "CAN'T_UPDATE_SUMMARY",
        `can't update wallet summary for ${wallet.address} `,
      );
    }
  }
}
