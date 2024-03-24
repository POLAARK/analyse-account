import { Account } from "../account/Account";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import MyEtherscanProvider from "../etherscanProvider/etherscanProvider";
import { TransactionResponseExtended } from "../transaction/transaction.entity";
import { EtherscanTransaction } from "../../types/etherscanHistory";
import { JsonRpcProviderManager } from "../jsonRpcProvider/JsonRpcProviderManager";
import { transactionRepository, walletRepository } from "modules/repository/Repositories";
import { Wallet } from "entity/Wallet";
import { Transaction } from "entity/Transaction";
import { logger } from "modules/logger/Logger";

config({ path: "src/../.env" });
export class TransactionStreamer {
  jsonRpcProviderManager: JsonRpcProviderManager = new JsonRpcProviderManager();
  etherscanProvider: MyEtherscanProvider = new MyEtherscanProvider(process.env.ETHERSCAN_API_KEY);
  accountList: Set<Account>;
  constructor(accountList: Account[]) {
    this.accountList = new Set(accountList);
  }

  async builtAccountTransactionHistory(lastBlock?: number, startBlock: number = 0) {
    try {
      // TODO, we should get lastBlock by transaction
      const latest = lastBlock
        ? lastBlock
        : await this.jsonRpcProviderManager.callProviderMethod<number>("getBlockNumber", []);
      let constStartBlock;
      for (let account of this.accountList) {
        // Check if the file exists and read the last updated block
        let wallet = new Wallet();
        try {
          wallet = await walletRepository.findOneBy({ address: account.address });
        } catch (err) {
          console.log(err);
          if (err == "EntityMetadataNotFoundError") {
          }
        }
        if (!wallet) {
          wallet = await walletRepository.create({
            address: account.address,
            lastBlockUpdated: 0,
            transactions: [],
            numberOfTokensTraded: 0,
            performanceUSD: 0,
            numberOfTxs: 0,
            lastAnalysisTimestamp: 0,
            startAnalysisTimestamp: 0,
          } as Wallet);
          constStartBlock = startBlock;
        }

        constStartBlock = wallet.lastBlockUpdated + 1;

        const history = await this.etherscanProvider.constructGlobalTransactionHistory(
          account.address,
          constStartBlock,
          latest
        );

        wallet.lastBlockUpdated = latest;
        await walletRepository.save(wallet);
        await this.saveHistoryToDB(history, wallet);
      }
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  async saveHistoryToDB(history: EtherscanTransaction[], wallet: Wallet) {
    try {
      for (const tx of history) {
        if (tx.isError == "1") {
        }
        console.log(tx.value);
        const transaction = new Transaction();
        transaction.hash = tx.hash;
        transaction.wallet = wallet;
        transaction.blockNumber = tx.blockNumber;
        transaction.timeStamp = tx.timeStamp;
        transaction.fromAddress = tx.from;
        transaction.toAddress = tx.to;
        transaction.value = tx.value;
        transaction.gas = tx.gas;
        transaction.input = tx.input;
        transaction.contractAddress = tx.contractAddress;

        await transactionRepository.save(transaction);
      }
    } catch (error) {
      logger.error(error);
      throw Error(error);
    }
  }

  addAccountsToStreamer(accountList: Account[]) {
    for (let account of accountList) {
      if (this.accountList.has(account)) {
        throw new Error(
          "Account already in list, here is the list " + Array.from(this.accountList).toString()
        );
      } else {
        this.accountList.add(account);
      }
    }
  }
}
