import {
  Contract,
  Interface,
  JsonRpcProvider,
  LogDescription,
  TransactionResponse,
  ethers,
  formatEther,
} from "ethers";
import {
  TransactionList,
  TransactionResponseExtended,
  TransferTx,
} from "../transaction/transaction.entity.js";
import {
  BigIntDivisionForAmount,
  determineTransactionType,
  getETHtoUSD,
} from "../transaction/transaction.utils.js";
import { erc20 } from "../abis/erc20.js";
import fs from "fs";

import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import { BalanceHistory, TokenHistory } from "./account.entity.js";
import {
  OneContainsStrings,
  containsUsdOrEth,
} from "../../utils/stringUtils.js";

interface TokenTransactions {
  transactionList: TransactionList[];
  performanceETH: number;
  performanceUSD: number;
}
config({ path: "src/../.env" });
export class Account {
  jsonRpcProvider: JsonRpcProvider;
  transactionList: TransactionResponseExtended[] = []; // TransactionList
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
      this.lastBlockUpdate = data.lastBlockUpdated
        ? data.lastBlockUpdated
        : this.lastBlockUpdate;
      this.transactionList = data.transactionsList
        ? data.transactionsList
        : this.transactionList;
    }

    this.historyFilePath = path.join(
      this.__dirname,
      "../../../data/histories/",
      `${this.address}History.json`
    );

    if (fs.existsSync(this.historyFilePath)) {
      this.balanceHistory = JSON.parse(
        fs.readFileSync(this.historyFilePath, "utf8")
      );
    } else {
      this.balanceHistory = {
        summary: {
          numberOfTokensTraded: 0,
          performanceUSD: 0,
          numberOfTxs: 0,
        },
        tokenHistories: {},
      };
      fs.promises.writeFile(
        this.historyFilePath,
        JSON.stringify(this.balanceHistory)
      );
    }
  }

  getAccountBalance() {}

  async processTransaction(tx: TransactionResponseExtended) {
    return await this.getTransactionTransferSummary(tx);
  }

  async updateBalances({
    transferTxSummary,
  }: {
    transferTxSummary: TransferTx[];
  }) {
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
        if (tokenAddress in this.balanceHistory) {
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
        //Ex: check what are the transfers when I interact with VetMe token
        // if (tokenAddress == "0xe7eF051C6EA1026A70967E8F04da143C67Fa4E1f") {
        //   console.log(transferTxSummary);
        // }
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
    let pairDiffETH: boolean = false;
    //TODO: remove tx from array when it is process ?
    for (let transferTx of transferTxSummary) {
      if (transferTx?.status) {
        let pairType: "ETH" | "USD" = OneContainsStrings(transferTx.symbol, [
          "usd",
        ])
          ? "USD"
          : OneContainsStrings(transferTx.symbol, ["eth"])
          ? "ETH"
          : null;
        if (pairType) {
          pairDiffETH = true;
          this.balanceHistory.tokenHistories[tokenAddress].pair = pairType;
          let amount = Number(transferTx.amount);
          if (pairType == "ETH") {
            if (transferTx.status === "IN") {
              this.balanceHistory.tokenHistories[tokenAddress].EthGained +=
                amount;
              this.balanceHistory.tokenHistories[tokenAddress].performanceUSD +=
                getETHtoUSD(amount, transferTx.timestamp);
            } else if (transferTx.status === "OUT") {
              this.balanceHistory.tokenHistories[tokenAddress].EThSpent +=
                amount;
              this.balanceHistory.tokenHistories[tokenAddress].performanceUSD -=
                getETHtoUSD(amount, transferTx.timestamp);
            }
          } else {
            if (transferTx.status === "IN") {
              this.balanceHistory.tokenHistories[tokenAddress].pairGained +=
                amount;
              this.balanceHistory.tokenHistories[tokenAddress].performanceUSD +=
                amount;
            } else if (transferTx.status === "OUT") {
              this.balanceHistory.tokenHistories[tokenAddress].pairSpent +=
                amount;
              this.balanceHistory.tokenHistories[tokenAddress].performanceUSD -=
                amount;
            }
          }
        }
      }
    }
    if (!pairDiffETH) {
      for (let transferTx of transferTxSummary) {
        if (!transferTx?.status && tokenAddress !== transferTx.tokenAdress) {
          // WE HAVE TO MAKE SURE IT'S WETH SO WE ARE GOING TO DO AND =/= from token
          // BUT IT CAN BE WHATEVER SO, WE HAVE TO DO, == WETH adrr (in db).
          this.balanceHistory.tokenHistories[tokenAddress].pair = "ETH";
          let amount = Number(transferTx.amount);
          if (tokenPath === "IN") {
            this.balanceHistory.tokenHistories[tokenAddress].EThSpent += amount;
            this.balanceHistory.tokenHistories[tokenAddress].performanceUSD -=
              getETHtoUSD(amount, transferTx.timestamp);
          } else if (tokenPath === "OUT") {
            this.balanceHistory.tokenHistories[tokenAddress].EthGained +=
              amount;
            this.balanceHistory.tokenHistories[tokenAddress].performanceUSD +=
              getETHtoUSD(amount, transferTx.timestamp);
          }
        }
      }
    }
  }

  getAccountTransaction(txhash: string) {
    for (let transaction of this.transactionList) {
      if (txhash == transaction.hash) {
        return transaction;
      }
    }
  }

  async getAccountTransactions() {
    // const results = [];

    for (let transaction of this.transactionList) {
      try {
        const transactionSummary = await this.getTransactionTransferSummary(
          transaction
        );
        await this.updateBalances({
          transferTxSummary: [...transactionSummary],
        });
        return this.balanceHistory;
        // const result = { hash: transaction.hash, logs: logs };
        // results.push(result);
      } catch (error) {
        console.error(
          `Error processing transaction ${transaction.hash}:`,
          error
        );
        // results.push({ hash: transaction.hash, error: error.message });
      }
    }

    try {
      fs.promises.writeFile(
        this.historyFilePath,
        JSON.stringify(this.balanceHistory, null, 2)
      );
    } catch (error) {
      throw Error("Error writing to file");
    }
  }

  async getTransactionTransferSummary(
    tx: TransactionResponseExtended
  ): Promise<TransferTx[]> {
    // console.log("Processing transaction hash:", tx.hash); // Log the transaction hash
    const interfaceERC20 = new Interface(erc20);

    try {
      // Get transaction receipt
      const transactionReceipt =
        await this.jsonRpcProvider.getTransactionReceipt(tx.hash);

      //Loop through Log :
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
          this.jsonRpcProvider
        );
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
            timestamp: parseInt(tx?.timeStamp),
            tokenAdress: log.address,
            amount: BigIntDivisionForAmount(
              parsedLog.args[2] as bigint,
              10n ** tokenDecimals
            ),
            symbol: contractERC20.symbol
              ? ((await contractERC20.symbol()) as string)
              : undefined,
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
}
