import { JsonRpcProvider, TransactionResponse, ethers, formatEther } from "ethers";
import erc20 from "../abis/erc20.js";
import { determineTransactionType, TransactionList } from "../transaction/transaction.entity.js";
import { getETHtoUSD } from "../transaction/transaction.utils.js";

interface TokenTransactions {
    transactionList : TransactionList[]
    performanceETH : number;
    performanceUSD : number;
}
export class Account {
    jsonRpcProvider : JsonRpcProvider;
    transactionList : TransactionResponse[]; // TransactionList
    address : string;
    lastBlockUpdate : number; 
    tokenHistory: TokenTransactions[];
    balanceInETH: number;
    balanceInUSD: number;
    constructor(address : string) {
        this.address = this.address;
        this.jsonRpcProvider = new JsonRpcProvider(process.env.JSON_URL, {name : 'ethereum', chainId : 1 });
    }

    getAccountBalance() {

    }

    async processTransaction(tx: TransactionResponse) {
        // Example: Decoding transaction input to determine if it's a token transfer
        // This requires knowing the ABI of the token contract
        const tokenAddress = tx.to;
        const tokenContract = new ethers.Contract(tokenAddress, erc20, this.jsonRpcProvider);
        const decodedInput = tokenContract.interface.parseTransaction({ data: tx.data, value: tx.value });

        // Determine if buy or sell
        let transactionType: 'buy' | 'sell' | 'unknown' = determineTransactionType(this.address, tx, decodedInput); // Placeholder, actual logic needed

        // Calculate values in ETH
        let valueInETH = formatEther(tx.value); 

        // Calculate values in USD
        // This requires an external API call to get ETH to USD conversion rate
        let valueInUSD = getETHtoUSD(valueInETH);

        // Update token history and balances
        this.updateBalances(decodedInput.value, valueInETH, valueInUSD, transactionType);
    }
    
    updateBalances(value: bigint, valueInETH: string, valueInUSD: string, transactionType: string) {
        throw new Error("Method not implemented.");
    }


}