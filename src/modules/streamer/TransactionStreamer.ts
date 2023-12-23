import { Block, EtherscanProvider, JsonRpcProvider, TransactionResponse, ethers } from "ethers";
import { Account } from "../account/Account";
import path from "path";
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from "dotenv";
import MyEtherscanProvider from "../etherscanProvider/etherscanProvider.js";
import { TransactionResponseExtended } from "../transaction/transaction.entity";

config({ path: 'src/../.env' });
export class TransactionStreamer {
    jsonRpcProvider: JsonRpcProvider;
    etherscanProvider : MyEtherscanProvider;
    accountList: Account[]; //To be typed;
    __dirname : string;
    constructor(accountList : Account[]) {
        this.__dirname = path.dirname(fileURLToPath(import.meta.url));
        this.jsonRpcProvider = new JsonRpcProvider(process.env.JSON_URL, 'mainnet');
        this.etherscanProvider = new MyEtherscanProvider(process.env.API_ethereum)
        this.accountList = accountList;

    }

    async builtAccountTransactionHistory(last? : number, start? : number) {
        
        const latest = last ? last : await this.jsonRpcProvider.getBlockNumber();
         
        for (let account of this.accountList) {
            
            const filePath = path.join( this.__dirname ,"../../../data/wallets/", `${account.address}.json`);

            // Check if the file exists and read the last updated block
            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                account.lastBlockUpdate = data.lastBlockUpdated ? data.lastBlockUpdated : account.lastBlockUpdate ;
                account.transactionList = data.transactionsList ? data.transactionsList : account.transactionList; 
            }
            
            const history = await this.etherscanProvider.getNormalTransactions(account.address, start ? start : 0, latest);
            history.forEach((tx : TransactionResponseExtended, index : number) => {
                if (index == 0 && tx.blockNumber > account.lastBlockUpdate)
                {
                    account.lastBlockUpdate = tx.blockNumber;
                }
                account.transactionList.push(tx);
            })
            fs.writeFileSync(filePath, JSON.stringify({
                lastBlockUpdated: account.lastBlockUpdate,
                transactionsList: account.transactionList
            }, null, 2));
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


}