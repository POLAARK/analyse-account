import { config } from "dotenv";
import { CustomError } from "error/customError";
import { inject, injectable } from "inversify";
import SERVICE_IDENTIFIER from "ioc_container/identifiers";
import { ILogger } from "logger";
import { ITokenHistoryRepository } from "tokenHistory/ITokenHistoryRepository";
import { TokenHistory } from "tokenHistory/TokenHistory";
import { ITransactionRepository, TransferTransaction } from "transaction";
import { ITransactionService } from "transaction/ITransactionService";
import { MoreThan } from "typeorm";
import { IWalletRepository } from "wallet";
import { Wallet } from "wallet/Wallet";
import { OneContainsStrings } from "../utils/stringUtils";
import { IEthOhlcService } from "ethOhlc";

config({ path: "src/../.env" });

@injectable()
export class AccountService {
  // transactionList: Transaction[] = [];
  // address: string;
  // walletEntity: Wallet;
  constructor(
    @inject(SERVICE_IDENTIFIER.Logger) private readonly logger: ILogger,
    @inject(SERVICE_IDENTIFIER.EthOhlcService)
    private readonly ethOhlcService: IEthOhlcService,
    @inject(SERVICE_IDENTIFIER.TransactionService)
    private readonly transactionService: ITransactionService,
    @inject(SERVICE_IDENTIFIER.TransactionService)
    private readonly tokenHistoryRepository: ITokenHistoryRepository,
    @inject(SERVICE_IDENTIFIER.TransactionRepository)
    private readonly transactionRepository: ITransactionRepository,
    @inject(SERVICE_IDENTIFIER.WalletRepository)
    private readonly walletRepository: IWalletRepository
  ) {}

  async updateBalances(
    {
      transferTxSummary,
    }: {
      transferTxSummary: TransferTransaction[];
    },
    address: string
  ): Promise<void> {
    let pairType: "ETH" | "USD" | null;

    const result = await this.transactionService.findMainTokenTradedOnTransaction(
      transferTxSummary,
      address
    );
    if (!result.tokenHistory) return;

    const updatedTransferTransactionSummary: TransferTransaction[] =
      result.updatedTransferTransactionSummary;
    const tokenHistory: TokenHistory = result.tokenHistory; //May be we didn't find a token address (meaning we interacted with no token in the transaction)
    const tokenPath: "IN" | "OUT" | undefined = result.tokenPath;

    if (tokenHistory.tokenAddress == "") {
      return;
    }

    for (let transferTx of updatedTransferTransactionSummary) {
      if (transferTx?.status) {
        pairType = await this.updateTokenHistoryBasedOnPairType(transferTx, tokenHistory);
      }
    }
    if (!pairType) {
      await this.processFallbackTransfers(
        updatedTransferTransactionSummary,
        tokenHistory,
        tokenPath
      );
    }
    this.tokenHistoryRepository.saveOrUpdateTokenHistory(tokenHistory, 3);
    return;
  }

  async getAccountTradingHistory(address: string, timestamp: number): Promise<void> {
    // Fetch only transactions newer than `usedTimestamp`
    const transactions = await this.transactionRepository.find({
      where: { wallet: { address: address }, timeStamp: MoreThan(timestamp) },
      order: { timeStamp: "DESC" },
    });

    const transactionPromises = transactions.map(async (transaction) => {
      try {
        const transactionSummary =
          await this.transactionService.getTransactionTransferSummaryFromLog(transaction, address);
        return this.updateBalances(
          {
            transferTxSummary: [...transactionSummary],
          },
          address
        );
      } catch (error) {
        this.logger.error("Error during getTransactionTransferSummary and updateBalances");
        this.logger.error(error);
      }
    });

    try {
      await Promise.all(transactionPromises);

      const wallet = await this.walletRepository.findOneBy({ where: { address: address } });
      await this.updateWalletTimestamps(timestamp, wallet);
      await this.updateSummary(wallet);
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
  async updateSummary(wallet: Wallet) {
    try {
      const tokenHistories = await this.tokenHistoryRepository.find({
        where: { walletAddress: wallet.address },
      });
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

  async updateTokenHistoryForEthPair(transferTx: TransferTransaction, tokenHistory: TokenHistory) {
    let amount = Number(transferTx.amount);
    if (transferTx.status === "IN") {
      tokenHistory.EthGained += amount;
      tokenHistory.performanceUSD += await this.ethOhlcService.getETHtoUSD(
        amount,
        transferTx.timestamp
      );
    } else if (transferTx.status === "OUT") {
      tokenHistory.EthSpent += amount;
      tokenHistory.performanceUSD -= await this.ethOhlcService.getETHtoUSD(
        amount,
        transferTx.timestamp
      );
    }
  }

  updateTokenHistoryForUsdPair(transferTx: TransferTransaction, tokenHistory: TokenHistory) {
    let amount = Number(transferTx.amount);
    if (transferTx.status === "IN") {
      tokenHistory.USDGained += amount;
      tokenHistory.performanceUSD += amount;
    } else if (transferTx.status === "OUT") {
      tokenHistory.USDSpent += amount;
      tokenHistory.performanceUSD -= amount;
    }
  }

  async updateTokenHistoryBasedOnPairType(
    transferTx: TransferTransaction,
    tokenHistory: TokenHistory
  ): Promise<"ETH" | "USD" | null> {
    const pairType = OneContainsStrings(transferTx.symbol, ["usd"])
      ? "USD"
      : OneContainsStrings(transferTx.symbol, ["eth"])
      ? "ETH"
      : null;
    tokenHistory.pair = pairType;

    if (pairType === "ETH") {
      await this.updateTokenHistoryForEthPair(transferTx, tokenHistory);
    } else if (pairType) {
      this.updateTokenHistoryForUsdPair(transferTx, tokenHistory);
    }
    return pairType;
  }

  async processFallbackTransfers(
    transferTxSummary: TransferTransaction[],
    tokenHistory: TokenHistory,
    tokenPath: "IN" | "OUT" | undefined
  ) {
    for (let transferTx of transferTxSummary) {
      if (!transferTx?.status && tokenHistory.tokenAddress !== transferTx.tokenAdress) {
        // WE HAVE TO MAKE SURE IT'S WETH SO WE ARE GOING TO DO AND =/= from token
        // BUT IT CAN BE WHATEVER SO, WE HAVE TO DO, == WETH adrr (in db).
        // Dans le cas d'un trading avec du WETH : si le transfer n'est pas directement fait au compte;
        // Alors on fait l'hypothèse que ce qui est tradé dans les transferts logs AUTRE que le token
        // C'est la paire et elle fait le sens inverse du trade du token
        // So we don't have a transfer status (undefined)

        tokenHistory.pair = "ETH";
        let amount = Number(transferTx.amount);
        // Here we break the loop for sure because we assume that whatever the transfer the amount transfered is the full amount of the transfer
        // TODO: Explore this idea. To check for proper transfer we have to check for transaction to or from the address of previous transfer
        // in the same block
        // Or check if transfer corresponds to same amount
        // Or check if transfers has same from to with different amount then it is an other transfer that give us the total value
        if (tokenPath === "IN") {
          if (OneContainsStrings(transferTx.symbol, ["usd"])) {
            tokenHistory.USDSpent += amount;
            tokenHistory.performanceUSD -= amount;
            break;
          }
          if (OneContainsStrings(transferTx.symbol, ["eth"])) {
            tokenHistory.EthSpent += amount;
            tokenHistory.performanceUSD -= await this.ethOhlcService.getETHtoUSD(
              amount,
              transferTx.timestamp
            );
            break;
          }
        } else if (tokenPath === "OUT") {
          if (OneContainsStrings(transferTx.symbol, ["usd"])) {
            tokenHistory.USDGained += amount;
            tokenHistory.performanceUSD += amount;
            break;
          }
          if (OneContainsStrings(transferTx.symbol, ["eth"])) {
            tokenHistory.EthGained += amount;
            tokenHistory.performanceUSD += await this.ethOhlcService.getETHtoUSD(
              amount,
              transferTx.timestamp
            );
            break;
          }
        }
      }
    }
  }
}
