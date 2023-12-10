import { Block, JsonRpcProvider, TransactionResponse, ethers } from "ethers";
import { Account } from "../account/Account";
import path from "path";
import fs from 'fs';

export class TransactionStreamer {
    jsonRpcProvider: JsonRpcProvider;
    transactionList: any; // TransactionList
    accountList: Account[]; //To be typed;
    constructor() {
        this.jsonRpcProvider = new JsonRpcProvider(process.env.JSON_URL, { name: 'ethereum', chainId: 1 });
    }

    async builtAccountTransactionHistory() {
        const latestBlock = await this.jsonRpcProvider.getBlockNumber();
        for (let account of this.accountList) {
            const filePath = path.join(__dirname, `${account.address}.json`);

            // Check if the file exists and read the last updated block
            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                account.lastBlockUpdate = data.lastBlockUpdated;
                account.transactionList = data.transactionsList;
            }
        }
        for (let i = latestBlock; i >= latestBlock - 1000; i--) { // Example: last 1000 blocks
            const block: Block = await this.jsonRpcProvider.getBlock(i, true);
            block.prefetchedTransactions.forEach(async transaction => {
                for (let account of this.accountList) {
                    if ((transaction.from === account.address || transaction.to === account.address) && account.lastBlockUpdate <= i) {
                        account.transactionList.push(transaction);
                        account.lastBlockUpdate = i;
                    }
                }
            });

        }

        for (let account of this.accountList) {
            const filePath = path.join(__dirname, `${account.address}.json`);
            fs.writeFileSync(filePath, JSON.stringify({
                lastBlockUpdated: account.lastBlockUpdate,
                transactionsList: account.transactionList
            }, null, 2));
        }
    }


}