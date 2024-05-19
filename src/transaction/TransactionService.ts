import { ethers, formatEther, Interface, LogDescription, TransactionReceipt } from "ethers";
import { inject, injectable } from "inversify";
import SERVICE_IDENTIFIER from "ioc_container/identifiers";
import { IJsonRpcProviderManager } from "../jsonRpcProvider/IJsonRpcProviderManager";
import { ILogger } from "../logger/ILogger";
import { erc20 } from "../abis/erc20";
import { ITokenRepository } from "../token/ITokenRepository";
import { ITokenService } from "../token/ITokenService";
import { BigIntDivisionForAmount } from "../utils/BingIntDivision";
import { ITransactionRepository, Transaction, TransferTransaction } from "transaction";
import { ITokenHistoryRepository, TokenHistory } from "tokenHistory";
import { containsUsdOrEth } from "utils";
@injectable()
export class TransactionService {
  constructor(
    @inject(SERVICE_IDENTIFIER.JsonRpcProviderManager)
    private readonly jsonRpcProviderManager: IJsonRpcProviderManager,
    @inject(SERVICE_IDENTIFIER.TokenRepository) private readonly tokenRepository: ITokenRepository,
    @inject(SERVICE_IDENTIFIER.TransactionRepository)
    private readonly transactionRepository: ITransactionRepository,
    @inject(SERVICE_IDENTIFIER.Logger) private readonly logger: ILogger,
    @inject(SERVICE_IDENTIFIER.TokenService) private readonly tokenService: ITokenService,
    @inject(SERVICE_IDENTIFIER.TokenHistoryRepository)
    private readonly tokenHistoryRepository: ITokenHistoryRepository
  ) {}

  determineTransactionType(accountAddress: string, parsedLog: LogDescription): "IN" | "OUT" {
    if (parsedLog.args[0].toUpperCase() == accountAddress.toUpperCase()) {
      return "OUT";
    }
    if (parsedLog.args[1].toUpperCase() == accountAddress.toUpperCase()) {
      return "IN";
    }
    return;
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
        to: transactionReceipt.to,
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

        const parsedLog: LogDescription = interfaceERC20.parseLog(logCopy);

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
    } catch (e) {
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
    let aggregatedTransactions = {};
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
    let tokenHistory: TokenHistory | undefined;
    let tokenPath: "IN" | "OUT" | undefined;
    for (const transferTx of transferTxSummary) {
      if (!transferTx?.status || containsUsdOrEth(transferTx.symbol)) {
        continue; // Skip transactions that are either incomplete or do not involve USD or ETH.
      }

      if (!fallbackTransfer) {
        fallbackTransfer = transferTx;
      }
      const currentTokenAddress = transferTx.tokenAdress;
      tokenHistory = await this.tokenHistoryRepository.findOneBy({
        where: {
          tokenAddress: currentTokenAddress,
          walletAddress: walletAddress,
        },
      });

      if (tokenHistory) {
        const transactionIndex = transferTxSummary.indexOf(transferTx);
        tokenPath = transferTx.status;
        if (transactionIndex > -1) {
          transferTxSummary.splice(transactionIndex, 1);
          break;
        }
      }
    }

    if (!tokenHistory && fallbackTransfer) {
      let tokenHistory = new TokenHistory();
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
      tokenHistory.pair = null;
      tokenPath = fallbackTransfer.status;
      let index = transferTxSummary.indexOf(fallbackTransfer);
      if (index > -1) {
        transferTxSummary.splice(index, 1);
      }
    }

    return { updatedTransferTransactionSummary: transferTxSummary, tokenHistory, tokenPath };
  }

  async getAccountTransaction(txhash: string) {
    return await this.transactionRepository.findOneBy({
      hash: txhash,
    });
  }
}
