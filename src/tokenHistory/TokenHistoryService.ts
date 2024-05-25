import { config } from "dotenv";
import { IEthOhlcService } from "ethOhlc";
import { inject, injectable } from "inversify";
import SERVICE_IDENTIFIER from "ioc_container/identifiers";
import { ILogger } from "logger";
import { ITokenHistoryRepository } from "tokenHistory/ITokenHistoryRepository";
import { TokenHistory } from "tokenHistory/TokenHistory";
import { ITransactionRepository, TransferTransaction } from "transaction";
import { ITransactionService } from "transaction/ITransactionService";
import { IWalletRepository } from "wallet";
import { OneContainsStrings } from "../utils/stringUtils";
import { ITokenHistoryService } from "./ITokenHistoryService";

config({ path: "src/../.env" });

@injectable()
export class TokenHistoryService implements ITokenHistoryService {
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
    private readonly tokenHistoryRepository: ITokenHistoryRepository
  ) {}

  /**
   * Input the details of an EVM transaction where transfers transactions have been abstracted
   * to be better understood what token goes where.
   *
   * 1 st : Find which token has been traded
   * 2 nd : Process the transfers that has been determined and update wallet
   * 3 rd : If no transfer direction has been determined : arbitrary determines one and udpates
   * 4 th : Update token History db
   *
   * @param { transferTxSummary : TransferTxTransaction }
   * @param address
   * @returns
   */
  async updateWalletTokenHistory(
    {
      transferTxSummary,
    }: {
      transferTxSummary: TransferTransaction[];
    },
    address: string
  ): Promise<void> {
    const result = await this.transactionService.findMainTokenTradedOnTransaction(
      transferTxSummary,
      address
    );

    if (!result.tokenHistory) return;

    const updatedTransferTransactionSummary: TransferTransaction[] =
      result.updatedTransferTransactionSummary;
    const tokenHistory: TokenHistory = result.tokenHistory;
    const tokenPath: "IN" | "OUT" | undefined = result.tokenPath;

    if (tokenHistory.tokenAddress == "") return;

    const isTransferStatus = await this.updateTokenHistoryBasedOnPairType(
      updatedTransferTransactionSummary,
      tokenHistory
    );

    // If we don't have any transfer status in all the transaction
    // (we can't determine where the value traded is going
    // (is it from the account ? to the account ? ...))
    if (!isTransferStatus) {
      await this.processFallbackTransfers(
        updatedTransferTransactionSummary,
        tokenHistory,
        tokenPath
      );
    }
    this.tokenHistoryRepository.saveOrUpdateTokenHistory(tokenHistory, 3);
    return;
  }

  /**
   * Determine the pair of the transaction using a specific transfer
   * If there is mention of either ETH or USD we know the value
   * of the token traded.
   *
   * @param transfer
   * @param tokenHistory
   * @returns
   */
  private async updateTokenHistoryBasedOnPairType(
    updatedTransferTransactionSummary: TransferTransaction[],
    tokenHistory: TokenHistory
  ): Promise<boolean> {
    let isTransferStatus = false; // Do we have transfer and we know the direction of the said transfer or don't we.
    for (let transfer of updatedTransferTransactionSummary) {
      if (transfer?.status) {
        isTransferStatus = true;
        const pairType = OneContainsStrings(transfer.symbol, ["usd"])
          ? "USD"
          : OneContainsStrings(transfer.symbol, ["eth"])
          ? "ETH"
          : null;
        tokenHistory.pair = pairType;

        if (pairType === "ETH") {
          await this.updateTokenHistoryForEthPair(transfer, tokenHistory);
        } else if (pairType) {
          this.updateTokenHistoryForUsdPair(transfer, tokenHistory);
        }
      }
    }
    return isTransferStatus;
  }

  private async processFallbackTransfers(
    transferTxSummary: TransferTransaction[],
    tokenHistory: TokenHistory,
    tokenPath: "IN" | "OUT" | undefined
  ) {
    for (let transfer of transferTxSummary) {
      if (!transfer?.status && tokenHistory.tokenAddress !== transfer.tokenAdress) {
        // WE HAVE TO MAKE SURE IT'S WETH SO WE ARE GOING TO DO AND =/= from token
        // BUT IT CAN BE WHATEVER SO, WE HAVE TO DO, == WETH adrr (in db).
        // Dans le cas d'un trading avec du WETH : si le transfer n'est pas directement fait au compte;
        // Alors on fait l'hypothèse que ce qui est tradé dans les transferts logs AUTRE que le token
        // C'est la paire et elle fait le sens inverse du trade du token
        // So we don't have a transfer status (undefined)

        tokenHistory.pair = "ETH";
        // Here we break the loop for sure because we assume that whatever the transfer the amount transfered is the full amount of the transfer
        // TODO: Explore this idea. To check for proper transfer we have to check for transaction to or from the address of previous transfer
        // in the same block
        // Or check if transfer corresponds to same amount
        // Or check if transfers has same from to with different amount then it is an other transfer that give us the total value
        transfer.status = tokenPath === "IN" ? "OUT" : "IN";

        if (OneContainsStrings(transfer.symbol, ["usd"])) {
          this.updateTokenHistoryForUsdPair(transfer, tokenHistory);
        } else if (OneContainsStrings(transfer.symbol, ["eth"])) {
          this.updateTokenHistoryForEthPair(transfer, tokenHistory);
        }
      }
    }
  }

  private async updateTokenHistoryForEthPair(
    transferTx: TransferTransaction,
    tokenHistory: TokenHistory
  ) {
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

  private updateTokenHistoryForUsdPair(
    transferTx: TransferTransaction,
    tokenHistory: TokenHistory
  ) {
    let amount = Number(transferTx.amount);
    if (transferTx.status === "IN") {
      tokenHistory.USDGained += amount;
      tokenHistory.performanceUSD += amount;
    } else if (transferTx.status === "OUT") {
      tokenHistory.USDSpent += amount;
      tokenHistory.performanceUSD -= amount;
    }
  }
}
