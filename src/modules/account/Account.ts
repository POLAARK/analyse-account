import { Contract, Interface, LogDescription, TransactionReceipt, ethers } from "ethers";
import {
  TransactionList,
  TransactionResponseExtended,
  TransferTx,
} from "../transaction/transaction.entity";
import {
  BigIntDivisionForAmount,
  determineTransactionType,
  getETHtoUSD,
} from "../transaction/transaction.utils";
import { erc20 } from "../abis/erc20";
import fs from "fs";

import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import { BalanceHistory } from "./account.entity";
import { OneContainsStrings, containsUsdOrEth } from "../../utils/stringUtils";
import { logger } from "../logger/Logger";
import { EtherscanTransaction } from "../../model/etherscanHistory";
import { JsonRpcProviderManager } from "../jsonRpcProvider/JsonRpcProviderManager";
import { PerformanceMeasurer } from "../performance/PerformanceMeasurer";
import { Wallet } from "entity/Wallet";
import {
  tokenHistoryRepository,
  tokenRepository,
  transactionRepository,
  walletRepository,
} from "modules/repository/Repositories";
import { Transaction } from "entity/Transaction";
import { TokenHistory } from "entity/TokenHistory";
import { MoreThan } from "typeorm";
import { timeStamp } from "console";
import { Token } from "entity/Token";
interface TokenTransactions {
  transactionList: TransactionList[];
  performanceETH: number;
  performanceUSD: number;
}

config({ path: "src/../.env" });
export class Account {
  jsonRpcProviderManager: JsonRpcProviderManager;
  transactionList: Transaction[] = [];
  address: string;
  walletEntity: Wallet;
  constructor(address: string) {
    this.address = address;
    this.jsonRpcProviderManager = new JsonRpcProviderManager();
  }

  getAccountBalance() {}

  async processTransaction(tx: TransactionResponseExtended) {
    return await this.getTransactionTransferSummary(tx);
  }

  async updateBalances({ transferTxSummary }: { transferTxSummary: TransferTx[] }) {
    let tokenSymbol: string = "";
    let tokenAddress: string = "";
    let tokenPath: "IN" | "OUT" | undefined;
    let tokenHistory: TokenHistory;
    for (let transferTx of transferTxSummary) {
      // NOTE: FOR NOW WE REMOVE INNER TRANSFERS THAT HAVE NO INTERACTION WITH ACCOUNT
      if (transferTx?.status && !containsUsdOrEth(transferTx.symbol)) {
        //The whole is used just to determine which token has been interacted/traded with
        //This implies that we create some problems if there are multiples tokens traded in the same account.
        tokenAddress = transferTx.tokenAdress;
        tokenSymbol = transferTx.symbol;
        tokenPath = transferTx.status;

        tokenHistory = await tokenHistoryRepository.findOne({
          where: {
            tokenAddress: tokenAddress,
            walletAddress: this.address,
          },
        });
        tokenHistory.numberOfTx += 1;

        if (!tokenHistory) {
          tokenHistory = {
            tokenAddress: tokenAddress,
            tokenSymbol: tokenSymbol,
            EthGained: 0,
            EthSpent: 0,
            USDSpent: 0,
            USDGained: 0,
            numberOfTx: 1,
            lastTxBlock: transferTx.blockNumber,
            performanceUSD: 0,
            wallet: this.walletEntity,
            walletAddress: this.address,
            pair: null,
          };
        }
        let index = transferTxSummary.indexOf(transferTx);
        if (index > -1) {
          transferTxSummary.splice(index, 1);
        }
        break;
      }
    }
    //May be we didn't find a token address (meaning we interacted with no token in the transaction)
    if (tokenAddress == "") {
      return;
    }

    let pairType: "ETH" | "USD" | null;
    for (let transferTx of transferTxSummary) {
      if (transferTx?.status) {
        pairType = OneContainsStrings(transferTx.symbol, ["usd"])
          ? "USD"
          : OneContainsStrings(transferTx.symbol, ["eth"])
          ? "ETH"
          : null;
        tokenHistory.pair = pairType;
        let amount = Number(transferTx.amount);
        if (pairType == "ETH") {
          if (transferTx.status === "IN") {
            tokenHistory.EthGained += amount;
            tokenHistory.performanceUSD += getETHtoUSD(amount, transferTx.timestamp);
          } else if (transferTx.status === "OUT") {
            tokenHistory.EthSpent += amount;
            tokenHistory.performanceUSD -= getETHtoUSD(amount, transferTx.timestamp);
          }
        } else if (pairType) {
          if (transferTx.status === "IN") {
            tokenHistory.USDGained += amount;
            tokenHistory.performanceUSD += amount;
          } else if (transferTx.status === "OUT") {
            tokenHistory.USDSpent += amount;
            tokenHistory.performanceUSD -= amount;
          }
        }
      }
    }
    if (!pairType) {
      for (let transferTx of transferTxSummary) {
        if (!transferTx?.status && tokenAddress !== transferTx.tokenAdress) {
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
              tokenHistory.USDSpent += amount;
              tokenHistory.performanceUSD -= getETHtoUSD(amount, transferTx.timestamp);
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
              tokenHistory.performanceUSD += getETHtoUSD(amount, transferTx.timestamp);
              break;
            }
          }
        }
      }
    }
    await tokenHistoryRepository.save(tokenHistory);
  }

  async getAccountTransaction(txhash: string) {
    return await transactionRepository.findOne({
      where: {
        hash: txhash,
      },
    });
  }

  async getAccountTradingHistory(timestamp: number): Promise<void> {
    // Fetch only transactions newer than `usedTimestamp`
    const transactions = await transactionRepository.find({
      where: { wallet: { address: this.address }, timeStamp: MoreThan(timestamp) },
      order: { timeStamp: "DESC" },
    });

    try {
      const transactionPromises = transactions.map(async (transaction) => {
        const transactionSummary = await this.getTransactionTransferSummary(transaction);
        return this.updateBalances({
          transferTxSummary: [...transactionSummary],
        });
      });
      await Promise.all(transactionPromises);

      const wallet = await walletRepository.findOne({ where: { address: this.address } });
      await this.updateWalletTimestamps(timestamp, wallet);
      await this.updateSummary(wallet);
      await walletRepository.save(wallet);

      return;
    } catch (error) {
      logger.error(`Error in getAccountTransactions:`, error);
      throw Error("Error in getAccountTransactions");
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

  async updateSummary(wallet: Wallet) {
    const tokenHistories = await tokenHistoryRepository.find({
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
  }

  async getTransactionTransferSummary(
    tx: TransactionResponseExtended | EtherscanTransaction | Transaction
  ): Promise<TransferTx[]> {
    const interfaceERC20 = new Interface(erc20);

    try {
      // Get transaction receipt
      const perf = new PerformanceMeasurer();

      // Code block you want to measure goes here
      perf.start("getTransactionReceipt");

      const transactionReceipt =
        await this.jsonRpcProviderManager.callProviderMethod<TransactionReceipt>(
          "getTransactionReceipt",
          [tx.hash],
          1000
        );
      perf.stop("getTransactionReceipt");

      let transferTxSummary: TransferTx[] = [];

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
        perf.start("Symbol and decimals");
        let token: Token = await tokenRepository.findOne({ where: { address: log.address } });
        let tokenDecimals: bigint;
        let tokenSymbol: string;
        if (token) {
          tokenSymbol = token.symbol;
          tokenDecimals = token.decimals;
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
            }
            tokenRepository.save(token);
          } catch (err) {
            tokenSymbol = "ERR_TOKEN_SYMBOL";
            tokenDecimals = 18n;
          }
        }

        perf.stop("Symbol and decimals");

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
                BigIntDivisionForAmount(parsedLog.args[2] as bigint, 10n ** tokenDecimals)
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
        let key1 = `${tx.tokenAdress}-${tx.from}`;
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
        logger.error("Error processing transaction:", tx.hash, e);
      }
      return [];
    }
  }
}
