import { Contract, Interface, JsonRpcProvider, LogDescription, ethers } from "ethers";
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
import { logger } from "../config /logger";
import { EtherscanTransaction } from "src/model/etherscanHistory";
interface TokenTransactions {
  transactionList: TransactionList[];
  performanceETH: number;
  performanceUSD: number;
}
config({ path: "src/../.env" });
export class Account {
  jsonRpcProvider: JsonRpcProvider;
  transactionList: EtherscanTransaction[] = [];
  address: string;
  lastBlockUpdate: number = 0;
  balanceHistory: BalanceHistory;
  __dirname: string;
  historyFilePath: string;
  constructor(address: string) {
    this.address = address;
    this.jsonRpcProvider = new JsonRpcProvider(process.env.JSON_URL, {
      name: "ethereum",
      chainId: 1,
    });

    this.__dirname = path.dirname(fileURLToPath(import.meta.url));
    const walletfilePath = path.join(
      this.__dirname,
      "../../../data/wallets/",
      `${this.address}.json`
    );

    if (fs.existsSync(walletfilePath)) {
      const data = JSON.parse(fs.readFileSync(walletfilePath, "utf8"));
      this.lastBlockUpdate = data.lastBlockUpdated ? data.lastBlockUpdated : this.lastBlockUpdate;
      this.transactionList = data.transactionsList ? data.transactionsList : this.transactionList;
    }

    this.historyFilePath = path.join(
      this.__dirname,
      "../../../data/histories/",
      `${this.address}History.json`
    );

    if (fs.existsSync(this.historyFilePath)) {
      this.balanceHistory = JSON.parse(fs.readFileSync(this.historyFilePath, "utf8"));
    } else {
      this.balanceHistory = {
        summary: {
          numberOfTokensTraded: 0,
          performanceUSD: 0,
          numberOfTxs: 0,
          lastAnalysisTimestamp: undefined,
          startAnalysisTimestamp: undefined,
        },
        tokenHistories: {},
      };
      fs.promises.writeFile(this.historyFilePath, JSON.stringify(this.balanceHistory));
    }
  }

  getAccountBalance() {}

  async processTransaction(tx: TransactionResponseExtended) {
    return await this.getTransactionTransferSummary(tx);
  }

  async updateBalances({ transferTxSummary }: { transferTxSummary: TransferTx[] }) {
    let tokenSymbol: string = "";
    let tokenAddress: string = "";
    let tokenPath: "IN" | "OUT" | undefined;
    for (let transferTx of transferTxSummary) {
      // NOTE: FOR NOW WE REMOVE INNER TRANSFERS THAT HAVE NO INTERACTION WITH ACCOUNT
      if (transferTx?.status && !containsUsdOrEth(transferTx.symbol)) {
        //The whole is used just to determine which token has been interacted/traded with
        //This implies that we create some problems if there are multiples tokens traded in the same account.
        tokenAddress = transferTx.tokenAdress;
        tokenSymbol = transferTx.symbol;
        tokenPath = transferTx.status;
        if (tokenAddress in this.balanceHistory.tokenHistories) {
          //current = ;
          this.balanceHistory.tokenHistories[tokenAddress].numberOfTx += 1;
        } else {
          this.balanceHistory.tokenHistories[tokenAddress] = {
            tokenSymbol: tokenSymbol,
            EthGained: 0,
            EThSpent: 0,
            pairSpent: 0,
            pairGained: 0,
            numberOfTx: 1,
            lastTxBlock: transferTx.blockNumber,
            performanceUSD: 0,
          };
        }
        let index = transferTxSummary.indexOf(transferTx);
        if (index > -1) {
          transferTxSummary.splice(index, 1);
        }
        break;
      }
    }
    logger.info(tokenPath);
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
        this.balanceHistory.tokenHistories[tokenAddress].pair = pairType;
        let amount = Number(transferTx.amount);
        if (pairType == "ETH") {
          if (transferTx.status === "IN") {
            this.balanceHistory.tokenHistories[tokenAddress].EthGained += amount;
            this.balanceHistory.tokenHistories[tokenAddress].performanceUSD += getETHtoUSD(
              amount,
              transferTx.timestamp
            );
          } else if (transferTx.status === "OUT") {
            this.balanceHistory.tokenHistories[tokenAddress].EThSpent += amount;
            this.balanceHistory.tokenHistories[tokenAddress].performanceUSD -= getETHtoUSD(
              amount,
              transferTx.timestamp
            );
          }
        } else {
          if (transferTx.status === "IN") {
            this.balanceHistory.tokenHistories[tokenAddress].pairGained += amount;
            this.balanceHistory.tokenHistories[tokenAddress].performanceUSD += amount;
          } else if (transferTx.status === "OUT") {
            this.balanceHistory.tokenHistories[tokenAddress].pairSpent += amount;
            this.balanceHistory.tokenHistories[tokenAddress].performanceUSD -= amount;
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

          // if (transferTx.blockNumber == 19197966) {
          //   logger.info(transferTx);
          //   logger.info("Path :" + tokenPath);
          // }

          this.balanceHistory.tokenHistories[tokenAddress].pair = "ETH";
          let amount = Number(transferTx.amount);
          // Here we break the loop for sure because we assume that whatever the transfer the amount transfered is the full amount of the transfer
          // TODO: Explore this idea. To check for proper transfer we have to check for transaction to or from the address of previous transfer
          // in the same block
          // Or check if transfer corresponds to same amount
          // Or check if transfers has same from to with different amount then it is an other transfer that give us the total value
          if (tokenPath === "IN") {
            if (OneContainsStrings(transferTx.symbol, ["usd"])) {
              this.balanceHistory.tokenHistories[tokenAddress].pairSpent += amount;
              this.balanceHistory.tokenHistories[tokenAddress].performanceUSD -= amount;
              break;
            }
            if (OneContainsStrings(transferTx.symbol, ["eth"])) {
              this.balanceHistory.tokenHistories[tokenAddress].EThSpent += amount;
              this.balanceHistory.tokenHistories[tokenAddress].performanceUSD -= getETHtoUSD(
                amount,
                transferTx.timestamp
              );
              break;
            }
          } else if (tokenPath === "OUT") {
            if (OneContainsStrings(transferTx.symbol, ["usd"])) {
              this.balanceHistory.tokenHistories[tokenAddress].pairGained += amount;
              this.balanceHistory.tokenHistories[tokenAddress].performanceUSD += amount;
              break;
            }
            if (OneContainsStrings(transferTx.symbol, ["eth"])) {
              this.balanceHistory.tokenHistories[tokenAddress].EthGained += amount;
              this.balanceHistory.tokenHistories[tokenAddress].performanceUSD += getETHtoUSD(
                amount,
                transferTx.timestamp
              );
              break;
            }
          }
        }
      }
    }
    logger.info(transferTxSummary);
    logger.info("---------------");
    logger.info(this.balanceHistory.tokenHistories[tokenAddress]);
  }

  getAccountTransaction(txhash: string) {
    for (let transaction of this.transactionList) {
      if (txhash == transaction.hash) {
        return transaction;
      }
    }
  }

  async getAccountTransactions(timestamp: number) {
    let usedTimestamp: number = this.updateTimestamp(timestamp);
    const decreasedOrderTxList = this.transactionList;

    for (let transaction of decreasedOrderTxList.reverse()) {
      if (usedTimestamp > Number(transaction.timeStamp)) {
        break;
      }
      try {
        const transactionSummary = await this.getTransactionTransferSummary(transaction);
        await this.updateBalances({
          transferTxSummary: [...transactionSummary],
        });
      } catch (error) {
        console.error(`Error processing transaction ${transaction.hash}:`, error);
      }
    }

    //Update timestamp
    if (
      !this.balanceHistory.summary.startAnalysisTimestamp ||
      this.balanceHistory.summary.startAnalysisTimestamp < timestamp
    ) {
      this.balanceHistory.summary.startAnalysisTimestamp = timestamp;
    }
    this.balanceHistory.summary.lastAnalysisTimestamp = Math.floor(Date.now() / 1000);

    this.updateSummary();

    try {
      fs.promises.writeFile(this.historyFilePath, JSON.stringify(this.balanceHistory, null, 2));
    } catch (error) {
      throw Error("Error writing to file");
    }
    return this.balanceHistory;
  }

  updateSummary() {
    this.balanceHistory.summary.numberOfTxs = 0;
    this.balanceHistory.summary.numberOfTokensTraded = 0;
    this.balanceHistory.summary.performanceUSD = 0;
    for (const address of Object.keys(this.balanceHistory.tokenHistories)) {
      const tokenHistory = this.balanceHistory.tokenHistories[address];
      this.balanceHistory.summary.numberOfTxs += tokenHistory.numberOfTx;
      this.balanceHistory.summary.numberOfTokensTraded += 1;
      this.balanceHistory.summary.performanceUSD += tokenHistory.performanceUSD;
    }
  }

  async getTransactionTransferSummary(
    tx: TransactionResponseExtended | EtherscanTransaction
  ): Promise<TransferTx[]> {
    // logger.info("Processing transaction hash:", tx.hash); // Log the transaction hash
    const interfaceERC20 = new Interface(erc20);

    try {
      // Get transaction receipt
      const transactionReceipt = await this.jsonRpcProvider.getTransactionReceipt(tx.hash);

      //Loop through Log :
      let transferTxSummary: TransferTx[] = [];

      for (let log of transactionReceipt.logs) {
        //Create a logCopy because of types :)
        let logCopy = {
          ...log,
          topics: [...log.topics],
        };
        let contractERC20: Contract;
        contractERC20 = new ethers.Contract(log.address, erc20, this.jsonRpcProvider);
        const parsedLog: LogDescription = interfaceERC20.parseLog(logCopy);
        let tokenDecimals: bigint;

        //No decimals ? decimals = 18
        try {
          tokenDecimals = await contractERC20.decimals();
        } catch (err) {
          tokenDecimals = 18n;
        }

        //Correct TransferObject
        if (parsedLog?.name && parsedLog.name === "Transfer") {
          let transferTx: TransferTx = {
            blockNumber: tx.blockNumber,
            timestamp: parseInt(tx?.timeStamp.toString()),
            tokenAdress: log.address,
            amount: BigIntDivisionForAmount(parsedLog.args[2] as bigint, 10n ** tokenDecimals),
            symbol: contractERC20.symbol ? ((await contractERC20.symbol()) as string) : undefined,
            status: determineTransactionType(this.address, parsedLog),
          };
          transferTxSummary.push(transferTx);
        }
      }

      return transferTxSummary;
    } catch (e) {
      if (e.code == "BUFFER_OVERRUN") {
        return [];
      } else {
        console.error("Error processing transaction:", tx.hash, e);
      }
      return [];
    }
  }

  updateTimestamp(timestamp: number): number {
    let usedTimestamp: number = timestamp;
    this.balanceHistory.summary.lastAnalysisTimestamp;
    this.balanceHistory.summary.startAnalysisTimestamp;
    if (
      this.balanceHistory.summary.startAnalysisTimestamp &&
      this.balanceHistory.summary.lastAnalysisTimestamp &&
      usedTimestamp > this.balanceHistory.summary.startAnalysisTimestamp
    ) {
      usedTimestamp = this.balanceHistory.summary.lastAnalysisTimestamp;
    }
    return usedTimestamp;
  }
}
