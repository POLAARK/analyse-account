import { JsonRpcProvider, TransactionResponse, ethers, formatEther } from "ethers";
import { TransactionList } from "../transaction/transaction.entity.js";
import { determineTransactionType, getETHtoUSD } from "../transaction/transaction.utils.js";
import { erc20 } from "../abis/erc20.js";
import fs from 'fs';
import path from "path";
import { fileURLToPath } from "url";

interface TokenTransactions {
    transactionList : TransactionList[]
    performanceETH : number;
    performanceUSD : number;
}
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
        // Example: Decoding transaction input to determine if it's a token transfer
        // This requires knowing the ABI of the token contract

        const tokenAddress = tx.to;
        const tokenContract = new ethers.Contract(tokenAddress, erc20, this.jsonRpcProvider);
        const decodedInput = tokenContract.interface.parseTransaction({ data: tx.data, value: tx.value });

        console.log(decodedInput); 

        let transactionType: 'buy' | 'sell' | 'unknown' = determineTransactionType(this.address, tx, decodedInput); // Placeholder, actual logic needed

        console.log(transactionType);
        let valueInETH = formatEther(tx.value); 

        // Calculate values in USD
        // This requires an external API call to get ETH to USD conversion rate
        let valueInUSD = getETHtoUSD(valueInETH);

        // this.updateBalances(decodedInput.value, valueInETH, valueInUSD, transactionType);
    }

    updateBalances(value: bigint, valueInETH: string, valueInUSD: string, transactionType: string) {
        throw new Error("Method not implemented.");
    }

    getAccountTransactions() {
        for (let transaction of this.transactionList){
            this.processTransaction(transaction);
        }
    }
}