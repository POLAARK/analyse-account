import { JsonRpcProvider, TransactionResponse, ethers, formatEther } from "ethers";
import { TransactionList } from "../transaction/transaction.entity.js";
import { determineTransactionType, getETHtoUSD, getTransactionTransferlogs } from "../transaction/transaction.utils.js";
import { erc20 } from "../abis/erc20.js";
import fs from 'fs';

import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

interface TokenTransactions {
    transactionList : TransactionList[]
    performanceETH : number;
    performanceUSD : number;
}
config({ path: 'src/../.env' });
export class Account {
    jsonRpcProvider : JsonRpcProvider;
    transactionList : TransactionResponse[] = []; // TransactionList
    address : string;
    lastBlockUpdate : number = 0; 
    tokenHistory: TokenTransactions[] = [];
    balanceInETH: number = 0;
    balanceInUSD: number = 0;
    __dirname : string;
    constructor(address : string) {

        this.address = address;
        this.jsonRpcProvider = new JsonRpcProvider(process.env.JSON_URL, {name : 'ethereum', chainId : 1 });
        this.__dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = path.join( this.__dirname ,"../../../data/wallets/", `${this.address}.json`);
        if (fs.existsSync(filePath)) {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            this.lastBlockUpdate = data.lastBlockUpdated ? data.lastBlockUpdated : this.lastBlockUpdate ;
            this.transactionList = data.transactionsList ? data.transactionsList : this.transactionList; 
        }
    }

    getAccountBalance() {

    }

    async processTransaction(tx: TransactionResponse) {
        return await getTransactionTransferlogs(this.jsonRpcProvider, tx);
    }

    updateBalances(value: bigint, valueInETH: string, valueInUSD: string, transactionType: string) {
        throw new Error("Method not implemented.");
    }

    getAccountTransaction(txhash : string) {
        for (let transaction of this.transactionList){
            if (txhash == transaction.hash) {
                return transaction;
            }
        }
    }
    async getAccountTransactions() {
        const results = [];

        for (let transaction of this.transactionList) {
            try {
                const logs = await getTransactionTransferlogs(this.jsonRpcProvider, transaction);
                const result = { hash: transaction.hash, logs: logs };
                results.push(result);
            } catch (error) {
                console.error(`Error processing transaction ${transaction.hash}:`, error);
                results.push({ hash: transaction.hash, error: error.message });
            }
        }

        try {
            fs.promises.writeFile('transactionsResults.json', JSON.stringify(results, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value 
        , 2));
        } catch (error) {
            console.error('Error writing to file:', error);
        }
    }

    async defineTransaction(logs: any) {
        let transactionType : string;
        for (let log of logs) {
            if (log.name == 'Transfer'){
                if (log.args[0] == this.address) {
                    const erc20Contract = new ethers.Contract(log.address, erc20, this.jsonRpcProvider);
                    transactionType = "Token sent"
                }
            }
        }
    }

}