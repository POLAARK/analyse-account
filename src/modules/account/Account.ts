import {
  Contract,
  Interface,
  LogDescription,
  TransactionReceipt,
  ethers,
  formatEther,
} from "ethers";
import { TransactionResponseExtended, TransferTx } from "../transaction/transaction.entity";
import {
  BigIntDivisionForAmount,
  determineTransactionType,
  getETHtoUSD,
} from "../transaction/transaction.utils";
import { erc20 } from "../abis/erc20";
import { config } from "dotenv";
import { OneContainsStrings, containsUsdOrEth } from "../../utils/stringUtils";
import { logger } from "../logger/Logger";
import { EtherscanTransaction } from "../../types/etherscanHistory";
import { JsonRpcProviderManager } from "../jsonRpcProvider/JsonRpcProviderManager";
import { PerformanceMeasurer } from "../performance/PerformanceMeasurer";
import { Wallet } from "entity/Wallet";
import {
  tokenRepository,
  transactionRepository,
  walletRepository,
} from "modules/repository/Repositories";
import { Transaction } from "entity/Transaction";
import { TokenHistory } from "entity/TokenHistory";
import { MoreThan } from "typeorm";
import { Token } from "entity/Token";
import { CustomError } from "modules/error/customError";
import { TokenHistoryRepository } from "repository/tokenHistoryRepository";
import { appDataSource } from "app";
import { EthOhlcRepository } from "../../repository/EthOhlcRepository";

config({ path: "src/../.env" });
export class Account {
  jsonRpcProviderManager: JsonRpcProviderManager;
  transactionList: Transaction[] = [];
  address: string;
  walletEntity: Wallet;
  tokenHistoryRepository = new TokenHistoryRepository(appDataSource);
  ethOhlcRepository = new EthOhlcRepository(appDataSource);
  constructor(address: string) {
    this.address = address;
    this.jsonRpcProviderManager = new JsonRpcProviderManager();
  }

  getAccountBalance() {}

  async processTransaction(tx: TransactionResponseExtended) {
    return await this.getTransactionTransferSummary(tx);
  }

  async updateBalances({ transferTxSummary }: { transferTxSummary: TransferTx[] }): Promise<void> {
    let pairType: "ETH" | "USD" | null;

    const result = await this.findMainTokenTradedOnTransaction(transferTxSummary, this.address);
    if (!result.tokenHistory) return;

    const updatedTransferTxSummary: TransferTx[] = result.updatedTransferTxSummary;
    const tokenHistory: TokenHistory = result.tokenHistory; //May be we didn't find a token address (meaning we interacted with no token in the transaction)
    const tokenPath: "IN" | "OUT" | undefined = result.tokenPath;

    if (tokenHistory.tokenAddress == "") {
      return;
    }

    for (let transferTx of updatedTransferTxSummary) {
      if (transferTx?.status) {
        pairType = await this.updateTokenHistoryBasedOnPairType(transferTx, tokenHistory);
      }
    }
    if (!pairType) {
      await this.processFallbackTransfers(updatedTransferTxSummary, tokenHistory, tokenPath);
    }
    this.tokenHistoryRepository.saveOrUpdateTokenHistory(tokenHistory);
    return;
  }

  async getAccountTransaction(txhash: string) {
    return await transactionRepository.findOneBy({
      hash: txhash,
    });
  }

  async getAccountTradingHistory(timestamp: number): Promise<void> {
    // Fetch only transactions newer than `usedTimestamp`
    const transactions = await transactionRepository.find({
      where: { wallet: { address: this.address }, timeStamp: MoreThan(timestamp) },
      order: { timeStamp: "DESC" },
    });

    const transactionPromises = transactions.map(async (transaction) => {
      try {
        const transactionSummary = await this.getTransactionTransferSummary(transaction);
        return this.updateBalances({
          transferTxSummary: [...transactionSummary],
        });
      } catch (error) {
        logger.error("Error during getTransactionTransferSummary and updateBalances");
        logger.error(error);
      }
    });

    try {
      await Promise.all(transactionPromises);

      const wallet = await walletRepository.findOne({ where: { address: this.address } });
      await this.updateWalletTimestamps(timestamp, wallet);
      await this.updateSummary(wallet);
      await walletRepository.save(wallet);
      console.log("End update trading repo + wallet Ts + update summary ");
      return;
    } catch (error) {
      logger.error(`Error in getAccountTradingHistory: `);
      logger.error(error);
    }
  }
  // async getAccountTradingHistory(timestamp: number): Promise<void> {
  //   // Fetch only transactions newer than `usedTimestamp`
  //   const transactions = await transactionRepository.find({
  //     where: { wallet: { address: this.address }, timeStamp: MoreThan(timestamp) },
  //     order: { timeStamp: "DESC" },
  //   });

  //   for (const transaction of transactions) {
  //     try {
  //       const transactionSummary = await this.getTransactionTransferSummary(transaction);
  //       await this.updateBalances({
  //         transferTxSummary: [...transactionSummary],
  //       });
  //     } catch (error) {
  //       logger.error("Error during getTransactionTransferSummary and updateBalances");
  //       console.log(error);
  //       // Optionally, you can continue to the next transaction, or re-throw the error to stop processing
  //       continue; // or throw error;
  //     }
  //   }

  //   try {
  //     const wallet = await walletRepository.findOne({ where: { address: this.address } });
  //     await this.updateWalletTimestamps(timestamp, wallet);
  //     await this.updateSummary(wallet);
  //     await walletRepository.save(wallet);
  //     console.log("End update trading repo + wallet Ts + update summary ");
  //   } catch (error) {
  //     logger.error(`Error in getAccountTradingHistory: `);
  //     logger.error(error);
  //   }
  // }

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

  async updateSummary(wallet: Wallet) {
    try {
      const tokenHistories = await this.tokenHistoryRepository.find({
        where: { walletAddress: this.address },
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

  async getTransactionTransferSummary(
    tx: TransactionResponseExtended | EtherscanTransaction | Transaction
  ): Promise<TransferTx[]> {
    const interfaceERC20 = new Interface(erc20);
    let transferTxSummary: TransferTx[] = [];
    const jsonRpcProviderManager = new JsonRpcProviderManager();
    try {
      const transactionReceipt =
        await jsonRpcProviderManager.callProviderMethod<TransactionReceipt>(
          "getTransactionReceipt",
          [tx.hash],
          1000
        );

      // If value we assume that the value send is the value traded
      // To keep the same logic we just add a transferTx object
      // it might be wrong, only tests will confirm
      const valueWei = BigInt(tx.value); // Convert string to BigNumber
      const valueEther = formatEther(valueWei); // Convert wei to ether

      if (!(valueWei == BigInt(0))) {
        transferTxSummary.push({
          blockNumber: tx.blockNumber,
          timestamp: parseInt(tx?.timeStamp.toString()),
          tokenAdress: "0x0",
          from: transactionReceipt.from,
          to: transactionReceipt.to,
          amount: parseFloat(parseFloat(valueEther).toFixed(3)), // Convert ether string to a fixed decimal format
          symbol: "WETH",
          status: "OUT",
        });
      }

      for (let log of transactionReceipt.logs) {
        //Create a logCopy because of types :)
        let logCopy = {
          ...log,
          topics: [...log.topics],
        };
        let contractERC20: Contract;
        contractERC20 = new ethers.Contract(
          log.address,
          erc20,
          this.jsonRpcProviderManager.getCurrentProvider()
        );

        const parsedLog: LogDescription = interfaceERC20.parseLog(logCopy);
        //No decimals ? decimals = 18
        let token: Token = await tokenRepository.findOne({ where: { address: log.address } });
        let tokenDecimals: bigint;
        let tokenSymbol: string;
        if (token) {
          tokenSymbol = token.symbol;
          tokenDecimals = BigInt(token.decimals);
        } else {
          try {
            tokenDecimals = BigInt(await contractERC20.decimals());
            tokenSymbol = await contractERC20.symbol();
            if (tokenSymbol.includes("USD") || tokenSymbol.includes("ETH")) {
              token = {
                address: log.address,
                decimals: tokenDecimals,
                symbol: tokenSymbol,
              };
              await tokenRepository.save(token);
            }
          } catch (err) {
            tokenSymbol = "ERR_TOKEN_SYMBOL";
            tokenDecimals = BigInt(18);
            if (err.code !== "CALL_EXCEPTION") {
              logger.error(err + " " + log.address);
            }
          }
        }
        //Correct TransferObject May be to be saved to DB ?
        if (parsedLog?.name && parsedLog.name === "Transfer") {
          let transferTx: TransferTx = {
            blockNumber: tx.blockNumber,
            timestamp: parseInt(tx?.timeStamp.toString()),
            tokenAdress: log.address,
            from: parsedLog.args[0],
            to: parsedLog.args[1],
            amount: parseFloat(
              Number(
                BigIntDivisionForAmount(parsedLog.args[2] as bigint, BigInt(10) ** tokenDecimals)
              ).toFixed(3)
            ),
            symbol: tokenSymbol,
            status: determineTransactionType(this.address, parsedLog),
          };
          transferTxSummary.push(transferTx);
        }
      }

      // If same token, from, to, aggregate the transaction
      // Is same token, from AND no status (could no determine where it goes) aggregate
      let aggregatedTransactions = {};
      transferTxSummary.forEach((tx) => {
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

      transferTxSummary = Object.values(aggregatedTransactions);
      return transferTxSummary;
    } catch (e) {
      if (e.code == "BUFFER_OVERRUN") {
        return [];
      } else {
        logger.error(`Error processing transaction: ${tx.hash} ${e}`);
        console.log(e);
      }
      return [];
    }
  }

  async findMainTokenTradedOnTransaction(
    transferTxSummary: TransferTx[],
    walletAddress: string
  ): Promise<{
    updatedTransferTxSummary: TransferTx[];
    tokenHistory: TokenHistory | null;
    tokenPath: "IN" | "OUT" | undefined;
  }> {
    let fallbackTransfer: TransferTx | null = null;
    let tokenHistory: TokenHistory | null = null;
    let tokenPath: "IN" | "OUT" | undefined;
    for (const transferTx of transferTxSummary) {
      if (!transferTx?.status || containsUsdOrEth(transferTx.symbol)) {
        continue; // Skip transactions that are either incomplete or do not involve USD or ETH.
      }

      if (!fallbackTransfer) {
        fallbackTransfer = transferTx;
      }
      const currentTokenAddress = transferTx.tokenAdress;
      tokenHistory = await this.tokenHistoryRepository.findOne({
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
      tokenHistory = {
        wallet: this.walletEntity,
        walletAddress: this.address,
        tokenAddress: fallbackTransfer.tokenAdress,
        tokenSymbol: fallbackTransfer.symbol,
        EthGained: 0,
        EthSpent: 0,
        USDSpent: 0,
        USDGained: 0,
        numberOfTx: 0,
        lastTxBlock: transferTxSummary[0].blockNumber,
        performanceUSD: 0,
        pair: null,
      };
      tokenPath = fallbackTransfer.status;
      let index = transferTxSummary.indexOf(fallbackTransfer);
      if (index > -1) {
        transferTxSummary.splice(index, 1);
      }
    }

    return { updatedTransferTxSummary: transferTxSummary, tokenHistory, tokenPath };
  }

  async updateTokenHistoryForEthPair(transferTx: TransferTx, tokenHistory: TokenHistory) {
    let amount = Number(transferTx.amount);
    if (transferTx.status === "IN") {
      tokenHistory.EthGained += amount;
      tokenHistory.performanceUSD += await getETHtoUSD(
        this.ethOhlcRepository,
        amount,
        transferTx.timestamp
      );
    } else if (transferTx.status === "OUT") {
      tokenHistory.EthSpent += amount;
      tokenHistory.performanceUSD -= await getETHtoUSD(
        this.ethOhlcRepository,
        amount,
        transferTx.timestamp
      );
    }
  }

  updateTokenHistoryForUsdPair(transferTx: TransferTx, tokenHistory: TokenHistory) {
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
    transferTx: TransferTx,
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
    transferTxSummary: TransferTx[],
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
            tokenHistory.performanceUSD -= await getETHtoUSD(
              this.ethOhlcRepository,
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
            tokenHistory.performanceUSD += await getETHtoUSD(
              this.ethOhlcRepository,
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
