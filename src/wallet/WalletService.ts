import { inject, injectable } from "inversify";
import SERVICE_IDENTIFIER from "../ioc_container/identifiers";
import { type ILogger } from "../logger";
import { type ITokenHistoryRepository, type ITokenHistoryService } from "../tokenHistory";
import { type ITransactionRepository, type ITransactionService } from "../transaction";
import { type IWalletRepository } from "./IWalletRepository";
import { Wallet } from "./Wallet";
import { type IWalletService } from "./IWalletService";
import { CustomError } from "../error/customError";

@injectable()
export class WalletService implements IWalletService {
  constructor(
    @inject(SERVICE_IDENTIFIER.TransactionRepository)
    private readonly transactionRepository: ITransactionRepository,
    @inject(SERVICE_IDENTIFIER.TransactionService)
    private readonly transactionService: ITransactionService,
    @inject(SERVICE_IDENTIFIER.TokenHistoryService)
    private readonly tokenHistoryService: ITokenHistoryService,
    @inject(SERVICE_IDENTIFIER.Logger) private readonly logger: ILogger,
    @inject(SERVICE_IDENTIFIER.WalletRepository)
    private readonly walletRepository: IWalletRepository,
    @inject(SERVICE_IDENTIFIER.TransactionService)
    private readonly tokenHistoryRepository: ITokenHistoryRepository
  ) {}
  /**
   * Create wallet trading History
   * @param address
   * @param timestamp
   * @returns
   */
  async createWalletTradingHistory(address: string, timestamp: number): Promise<void> {
    // Fetch only transactions newer than `timestamp`

    const transactions = await this.transactionRepository.findTransactionsByTimestamp(
      address,
      timestamp
    );
    // If we already parsed them and so updated the db for the actual token history
    // We will cumulate double transfers
    const transactionPromises = transactions.map(async (transaction) => {
      try {
        const transactionSummary =
          await this.transactionService.getTransactionTransferSummaryFromLog(transaction, address);
        return this.tokenHistoryService.updateWalletTokenHistory(
          {
            transferTxSummary: [...transactionSummary],
          },
          address
        );
      } catch (error) {
        this.logger.error("Error during createTransactionTransferSummary");
        this.logger.error(error);
      }
    });

    try {
      await Promise.all(transactionPromises);

      const wallet = await this.walletRepository.findOneByAddress(address);
      await this.updateWalletTimestamps(timestamp, wallet);
      await this.updateWalletSummary(wallet);
      await this.walletRepository.save(wallet);
      console.log("End update trading repo + wallet Ts + update summary ");
      return;
    } catch (error) {
      this.logger.error(`Error in getAccountTradingHistory: `);
      this.logger.error(error);
    }
  }

  async updateWalletTimestamps(timestamp: number, wallet: Wallet) {
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
  async updateWalletSummary(wallet: Wallet) {
    try {
      const tokenHistories = await this.tokenHistoryRepository.findAllByAddress(wallet.address);
      wallet.numberOfTokensTraded = tokenHistories.length;
      wallet.numberOfTxs = tokenHistories.reduce(
        (total, tokenHistory) => total + tokenHistory.numberOfTx,
        0
      );
      wallet.performanceUSD = tokenHistories.reduce(
        (total, tokenHistory) => total + tokenHistory.performanceUSD,
        0
      );
    } catch (error) {
      throw new CustomError(
        "CAN'T_UPDATE_SUMMARY",
        `can't update wallet summary for ${wallet.address} `
      );
    }
  }
}
