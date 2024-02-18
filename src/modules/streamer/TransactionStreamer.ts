import {
  Block,
  EtherscanProvider,
  JsonRpcProvider,
  TransactionResponse,
  ethers,
} from "ethers";
import { Account } from "../account/Account";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import MyEtherscanProvider from "../etherscanProvider/etherscanProvider.js";
import { TransactionResponseExtended } from "../transaction/transaction.entity";

config({ path: "src/../.env" });
export class TransactionStreamer {
  jsonRpcProvider: JsonRpcProvider = new JsonRpcProvider(
    process.env.JSON_URL,
    "mainnet"
  );
  etherscanProvider: MyEtherscanProvider = new MyEtherscanProvider(
    process.env.API_ethereum
  );
  accountList: Set<Account>;
  __dirname: string = path.dirname(fileURLToPath(import.meta.url));
  constructor(accountList: Account[]) {
    this.accountList = new Set(accountList);
  }

  async builtAccountTransactionHistory(last?: number, start?: number) {
    try {
      const latest = last ? last : await this.jsonRpcProvider.getBlockNumber();

      for (let account of this.accountList) {
        const filePath = path.join(
          this.__dirname,
          "../../../data/wallets/",
          `${account.address}.json`
        );

        // Check if the file exists and read the last updated block
        if (fs.existsSync(filePath)) {
          const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
          account.lastBlockUpdate = data.lastBlockUpdated
            ? data.lastBlockUpdated
            : account.lastBlockUpdate;
          account.transactionList = data.transactionsList
            ? data.transactionsList
            : account.transactionList;
        }
        const history = await this.etherscanProvider.getNormalTransactions(
          account.address,
          account.lastBlockUpdate ? account.lastBlockUpdate : start ? start : 0,
          latest
        );
        history.forEach((tx: TransactionResponseExtended, index: number) => {
          if (
            index == history.length - 1 &&
            tx.blockNumber > account.lastBlockUpdate
          ) {
            account.lastBlockUpdate = tx.blockNumber;
          }

          account.transactionList.push(tx);
        });
        console.log(account.lastBlockUpdate);
        fs.writeFileSync(
          filePath,
          JSON.stringify(
            {
              lastBlockUpdated: account.lastBlockUpdate,
              transactionsList: account.transactionList,
            },
            null,
            2
          )
        );
      }
    } catch (error) {
      throw Error(error);
    }
    // arbitrary 1000 block

    // for (let i = latestBlock; i >= end; i--) { // Example: last 1000 blocks
    //     console.log(i)
    //     const block: Block = await this.jsonRpcProvider.getBlock(i, true);
    //     console.log(block);
    //     block.prefetchedTransactions.forEach(async transaction => {
    //         for (let account of this.accountList) {
    //             if ((transaction.from === account.address || transaction.to === account.address) && account.lastBlockUpdate <= i) {
    //                 account.transactionList.push(transaction);
    //                 account.lastBlockUpdate = i;
    //             }
    //         }
    //     });

    // }
  }
  addAccountsToStreamer(accountList: Account[]) {
    for (let account of accountList) {
      if (this.accountList.has(account)) {
        throw new Error(
          "Account already in list, here is the list " +
            Array.from(this.accountList).toString()
        );
      } else {
        this.accountList.add(account);
      }
    }
  }
}
