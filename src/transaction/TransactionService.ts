import { ethers, Interface, LogDescription, TransactionReceipt } from "ethers";
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
import { addRawAmounts, formatUnitsToFixed } from "../utils/tokenUnits";

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
    private readonly tokenHistoryRepository: ITokenHistoryRepository,
  ) {}

  determineTransactionType(
    accountAddress: string,
    parsedLog: LogDescription,
  ): "IN" | "OUT" | undefined {
    if (parsedLog.args[0].toUpperCase() === accountAddress.toUpperCase()) {
      return "OUT";
    }
    if (parsedLog.args[1].toUpperCase() === accountAddress.toUpperCase()) {
      return "IN";
    }
    return undefined;
  }

  addTransferTransactionIfValue(
    transaction: Transaction,
    transferTransactionSummary: TransferTransaction[],
    transactionReceipt: TransactionReceipt,
  ): void {
    const valueWei = BigInt(transaction.value); // Raw native amount in wei

    if (valueWei !== 0n) {
      transferTransactionSummary.push({
        blockNumber: transaction.blockNumber,
        timestamp: parseInt(transaction?.timeStamp.toString(), 10),
        tokenAdress: "0x0",
        from: transactionReceipt.from,
        to: transactionReceipt.to || "",
        amountRaw: valueWei.toString(),
        tokenDecimals: 18,
        amount: parseFloat(formatUnitsToFixed(valueWei.toString(), 18, 3)),
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
    address: string,
  ): Promise<TransferTransaction[]> {
    const interfaceERC20 = new Interface(erc20);
    const transferTransactionSummary: TransferTransaction[] = [];
    try {
      const transactionReceipt =
        await this.jsonRpcProviderManager.callProviderMethod<TransactionReceipt>(
          "getTransactionReceipt",
          [transaction.hash],
          1000,
        );

      if (!transactionReceipt.logs) {
        throw new CustomError("NO_LOGS", `Transaction Logs : ${transactionReceipt.toString()}`);
      }
      // If value we assume that the value send is the value traded
      // To keep the same logic we just add a transferTx object
      // it might be wrong, only tests will confirm
      this.addTransferTransactionIfValue(
        transaction,
        transferTransactionSummary,
        transactionReceipt,
      );

      for (const log of transactionReceipt.logs) {
        //Create a logCopy because of types :)
        const logCopy = {
          ...log,
          topics: [...log.topics],
        };
        const tokenAddress: string = log.address;

        const contractERC20 = new ethers.Contract(
          tokenAddress,
          erc20,
          this.jsonRpcProviderManager.getCurrentProvider(),
        );

        const { tokenSymbol, tokenDecimals: tokenDecimalsRaw } =
          await this.tokenService.getTokenDetails(tokenAddress, contractERC20);

        const parsedLog: LogDescription | null = interfaceERC20.parseLog(logCopy);

        //Correct TransferObject May be to be saved to DB ?
        if (parsedLog?.name && parsedLog.name === "Transfer") {
          const amountRaw = (parsedLog.args[2] as bigint).toString();
          const tokenDecimals = Number(tokenDecimalsRaw);
          const transferTx: TransferTransaction = {
            blockNumber: transaction.blockNumber,
            timestamp: parseInt(transaction?.timeStamp.toString(), 10),
            tokenAdress: tokenAddress,
            from: parsedLog.args[0],
            to: parsedLog.args[1],
            amountRaw,
            tokenDecimals,
            amount: parseFloat(formatUnitsToFixed(amountRaw, tokenDecimals, 3)),
            symbol: tokenSymbol,
            status: this.determineTransactionType(address, parsedLog),
          };
          transferTransactionSummary.push(transferTx);
        }
      }
      return this.aggregateTransferTransactions(transferTransactionSummary);
    } catch (e: any) {
      if (e.code === "BUFFER_OVERRUN") {
        return [];
      } else {
        this.logger.error("Transaction processing failed");
      }
      return [];
    }
  }

  /**
   * If same token, from, to, aggregate
   * Is same token, from AND no status (could no determine where it goes) aggregate
   */
  aggregateTransferTransactions(
    transferTransactionSummary: TransferTransaction[],
  ): TransferTransaction[] {
    const aggregatedTransactions = new Map<string, TransferTransaction>();
    for (const tx of transferTransactionSummary) {
      const key1 = `${tx.tokenAdress}-${tx.from}-${tx.status}`;
      const key2 = `${tx.tokenAdress}-${tx.from}-${tx.to}`;
      const key = tx.status ? key2 : key1;
      const aggregatedTransaction = aggregatedTransactions.get(key);

      if (aggregatedTransaction) {
        aggregatedTransaction.amount += tx.amount;
        if (
          aggregatedTransaction.amountRaw !== undefined &&
          tx.amountRaw !== undefined &&
          aggregatedTransaction.tokenDecimals !== undefined &&
          tx.tokenDecimals !== undefined
        ) {
          // Lossless accumulation: sum raw amounts in bigint, then derive the display amount once.
          const { sumRaw, decimals } = addRawAmounts(
            aggregatedTransaction.amountRaw,
            aggregatedTransaction.tokenDecimals,
            tx.amountRaw,
            tx.tokenDecimals,
          );
          const sumRawText = sumRaw.toString();
          aggregatedTransaction.amountRaw = sumRawText;
          aggregatedTransaction.tokenDecimals = decimals;
          aggregatedTransaction.amount = parseFloat(formatUnitsToFixed(sumRawText, decimals, 3));
        }
      } else {
        aggregatedTransactions.set(key, { ...tx });
      }
    }
    return [...aggregatedTransactions.values()];
  }

  async findMainTokenTradedOnTransaction(
    transferTxSummary: TransferTransaction[],
    walletAddress: string,
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
        } catch {
          // Handle specific token history fetch errors or rethrow if necessary
          throw new CustomError("Failed to fetch token history", "CAN'T_FIND_MAIN_TOKEN");
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
          tokenHistory.EthGained = BigInt(0);
          tokenHistory.EthSpent = BigInt(0);
          tokenHistory.USDSpent = BigInt(0);
          tokenHistory.USDGained = BigInt(0);
          tokenHistory.numberOfTx = 0;
          tokenHistory.lastTxBlock = transferTxSummary[0].blockNumber;
          tokenHistory.performanceUSD = BigInt(0);
          tokenHistory.pair = "";
          tokenPath = fallbackTransfer.status;
          const index = transferTxSummary.indexOf(fallbackTransfer);
          if (index > -1) {
            transferTxSummary.splice(index, 1);
          }
        } catch {
          throw new CustomError("Failed to create fallback token history", "CAN'T_FIND_MAIN_TOKEN");
        }
      }

      if (!tokenHistory) {
        throw new CustomError(
          `Can't create token history for transaction at block ${transferTxSummary[0].blockNumber}`,
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
          error,
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
