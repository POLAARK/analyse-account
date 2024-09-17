import { ethers, formatEther, Interface, LogDescription, TransactionReceipt } from "ethers";
import { inject, injectable } from "inversify";
import { erc20 } from "../abis/erc20";
import { CustomError } from "../error/customError";
import SERVICE_IDENTIFIER from "../ioc_container/identifiers";
import { type IJsonRpcProviderManager } from "../jsonRpcProvider/IJsonRpcProviderManager";
import { type ILogger } from "../logger/ILogger";
import { type ITokenService } from "../token/ITokenService";
import { TokenHistory, type ITokenHistoryRepository } from "../tokenHistory";
import { Transaction, type ITransactionRepository, type TransferTransaction } from "../transaction";
import { containsUsdOrEth } from "../utils";
import { BigIntDivisionForAmount } from "../utils/BingIntDivision";

@injectable()
export class TransactionService {
  constructor(
    @inject(SERVICE_IDENTIFIER.JsonRpcProviderManager)
    private readonly jsonRpcProviderManager: IJsonRpcProviderManager,
    @inject(SERVICE_IDENTIFIER.TransactionRepository)
    private readonly transactionRepository: ITransactionRepository,
    @inject(SERVICE_IDENTIFIER.Logger) private readonly logger: ILogger,
    @inject(SERVICE_IDENTIFIER.TokenService) private readonly tokenService: ITokenService,
    @inject(SERVICE_IDENTIFIER.TokenHistoryRepository)
    private readonly tokenHistoryRepository: ITokenHistoryRepository
  ) {}

  determineTransactionType(
    accountAddress: string,
    parsedLog: LogDescription
  ): "IN" | "OUT" | undefined {
    if (parsedLog.args[0].toUpperCase() == accountAddress.toUpperCase()) {
      return "OUT";
    }
    if (parsedLog.args[1].toUpperCase() == accountAddress.toUpperCase()) {
      return "IN";
    }
    return undefined;
  }

  addTransferTransactionIfValue(
    transaction: Transaction,
    transferTransactionSummary: TransferTransaction[],
    transactionReceipt: TransactionReceipt
  ): void {
    const valueWei = BigInt(transaction.value); // Convert string to BigNumber
    const valueEther = formatEther(valueWei); // Convert wei to ether

    if (!(valueWei == BigInt(0))) {
      transferTransactionSummary.push({
        blockNumber: transaction.blockNumber,
        timestamp: parseInt(transaction?.timeStamp.toString()),
        tokenAdress: "0x0",
        from: transactionReceipt.from,
        to: transactionReceipt.to || "",
        amount: parseFloat(parseFloat(valueEther).toFixed(3)), // Convert ether string to a fixed decimal format
        symbol: "WETH",
        status: "OUT",
      });
    }
  }

  /**
   * This function get Transaction Receipt from the transaction and extracts the logs to understand
   * to which address the tokens goes.
   *
   * @param transaction
   * @param address
   * @returns The list of the aggregated transfer present in the transaction.
   */
  async getTransactionTransferSummaryFromLog(
    transaction: Transaction,
    address: string
  ): Promise<TransferTransaction[]> {
    const interfaceERC20 = new Interface(erc20);
    let transferTransactionSummary: TransferTransaction[] = [];
    try {
      const transactionReceipt =
        await this.jsonRpcProviderManager.callProviderMethod<TransactionReceipt>(
          "getTransactionReceipt",
          [transaction.hash],
          1000
        );

      if (!transactionReceipt.logs) {
        throw new CustomError("NO_LOGS", "Transaction Logs : " + transactionReceipt.toString());
      }
      // If value we assume that the value send is the value traded
      // To keep the same logic we just add a transferTx object
      // it might be wrong, only tests will confirm
      this.addTransferTransactionIfValue(
        transaction,
        transferTransactionSummary,
        transactionReceipt
      );

      for (let log of transactionReceipt.logs) {
        //Create a logCopy because of types :)
        const logCopy = {
          ...log,
          topics: [...log.topics],
        };
        const tokenAddress: string = log.address;

        const contractERC20 = new ethers.Contract(
          tokenAddress,
          erc20,
          this.jsonRpcProviderManager.getCurrentProvider()
        );

        const { tokenSymbol, tokenDecimals } = await this.tokenService.getTokenDetails(
          tokenAddress,
          contractERC20
        );

        const parsedLog: LogDescription | null = interfaceERC20.parseLog(logCopy);

        //Correct TransferObject May be to be saved to DB ?
        if (parsedLog?.name && parsedLog.name === "Transfer") {
          const transferTx: TransferTransaction = {
            blockNumber: transaction.blockNumber,
            timestamp: parseInt(transaction?.timeStamp.toString()),
            tokenAdress: tokenAddress,
            from: parsedLog.args[0],
            to: parsedLog.args[1],
            amount: parseFloat(
              Number(
                BigIntDivisionForAmount(parsedLog.args[2] as bigint, BigInt(10) ** tokenDecimals)
              ).toFixed(3)
            ),
            symbol: tokenSymbol,
            status: this.determineTransactionType(address, parsedLog),
          };
          transferTransactionSummary.push(transferTx);
        }
      }
      return this.aggregateTransferTransactions(transferTransactionSummary);
    } catch (e: any) {
      if (e.code == "BUFFER_OVERRUN") {
        return [];
      } else {
        this.logger.error(`Error processing transaction: ${transaction.hash} ${e}`);
        console.log(e);
      }
      return [];
    }
  }

  /**
   * If same token, from, to, aggregate
   * Is same token, from AND no status (could no determine where it goes) aggregate
   */
  aggregateTransferTransactions(
    transferTransactionSummary: TransferTransaction[]
  ): TransferTransaction[] {
    let aggregatedTransactions: any = {};
    transferTransactionSummary.forEach((tx) => {
      let key1 = `${tx.tokenAdress}-${tx.from}-${tx.status}`;
      let key2 = `${tx.tokenAdress}-${tx.from}-${tx.to}`;

      if (tx.status) {
        if (!aggregatedTransactions[key2]) {
          aggregatedTransactions[key2] = { ...tx, amount: 0 };
        }
        aggregatedTransactions[key2].amount += tx.amount;
      } else {
        if (!aggregatedTransactions[key1]) {
          aggregatedTransactions[key1] = { ...tx, amount: 0 };
        }
        aggregatedTransactions[key1].amount += tx.amount;
      }
    });
    return Object.values(aggregatedTransactions);
  }

  async findMainTokenTradedOnTransaction(
    transferTxSummary: TransferTransaction[],
    walletAddress: string
  ): Promise<{
    updatedTransferTransactionSummary: TransferTransaction[];
    tokenHistory: TokenHistory;
    tokenPath: "IN" | "OUT" | undefined;
  }> {
    let fallbackTransfer: TransferTransaction | null = null;
    let tokenHistory: TokenHistory | null = null;
    let tokenPath: "IN" | "OUT" | undefined;

    try {
      for (const transferTx of transferTxSummary) {
        // Skip transactions that are either incomplete (can't define if they are in or out the current wallet) or do not involve USD or ETH.
        if (!transferTx?.status || !containsUsdOrEth(transferTx.symbol)) {
          continue;
        }

        if (!fallbackTransfer) {
          fallbackTransfer = transferTx;
        }

        try {
          tokenHistory = await this.tokenHistoryRepository.findOneBy({
            tokenAddress: transferTx.tokenAdress,
            walletAddress: walletAddress,
          });
        } catch (error: any) {
          console.error(`Error fetching token history for ${transferTx.tokenAdress}:`, error);
          // Handle specific token history fetch errors or rethrow if necessary
          throw new CustomError(
            `Failed to fetch token history for token address ${transferTx.tokenAdress}`,
            "CAN'T_FIND_MAIN_TOKEN",
            error
          );
        }

        // Determines the current transaction to work.
        // We will update account and token history values using this Transfer
        if (tokenHistory) {
          const transactionIndex = transferTxSummary.indexOf(transferTx);
          tokenPath = transferTx.status;
          if (transactionIndex > -1) {
            transferTxSummary.splice(transactionIndex, 1);
            break;
          }
        }
      }

      // If no token have been found
      // But there is an acceptable IN OUT Transfer (fallback)
      // We record a new tokenHistory
      if (!tokenHistory && fallbackTransfer) {
        try {
          tokenHistory = new TokenHistory();
          tokenHistory.walletAddress = walletAddress;
          tokenHistory.tokenAddress = fallbackTransfer.tokenAdress;
          tokenHistory.tokenSymbol = fallbackTransfer.symbol;
          tokenHistory.EthGained = 0;
          tokenHistory.EthSpent = 0;
          tokenHistory.USDSpent = 0;
          tokenHistory.USDGained = 0;
          tokenHistory.numberOfTx = 0;
          tokenHistory.lastTxBlock = transferTxSummary[0].blockNumber;
          tokenHistory.performanceUSD = 0;
          tokenHistory.pair = "";
          tokenPath = fallbackTransfer.status;
          let index = transferTxSummary.indexOf(fallbackTransfer);
          if (index > -1) {
            transferTxSummary.splice(index, 1);
          }
        } catch (error) {
          console.error("Error creating fallback token history:", error);
          throw new CustomError(
            "Failed to create fallback token history.",
            "CAN'T_FIND_MAIN_TOKEN",
            error
          );
        }
      }

      if (!tokenHistory) {
        throw new CustomError(
          `Can't create token history for transaction at block ${transferTxSummary[0].blockNumber}`
        );
      }

      return {
        updatedTransferTransactionSummary: transferTxSummary,
        tokenHistory,
        tokenPath,
      };
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      } else {
        throw new CustomError(
          "Failed to find main token traded in the transaction.",
          "CAN'T_FIND_MAIN_TOKEN",
          error
        );
      }
    }
  }

  async getAccountTransaction(txhash: string) {
    return await this.transactionRepository.findOneBy({
      hash: txhash,
    });
  }

  async getTransactionByTimestamp(address: string, timestamp: number) {
    return await this.transactionRepository.findTransactionsByTimestamp(address, timestamp);
  }
}
