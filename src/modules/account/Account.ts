import { Contract, Interface, JsonRpcProvider, LogDescription, TransactionResponse, ethers, formatEther } from "ethers";
import { TransactionList, TransactionResponseExtended, TransferTx } from "../transaction/transaction.entity.js";
import { BigIntDivisionForAmount, determineTransactionType } from "../transaction/transaction.utils.js";
import { erc20 } from "../abis/erc20.js";
import fs from 'fs';

import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import { BalanceHistory, TokenHistory } from "./account.entity.js";
import { OneContainsStrings, containsUsdOrEth } from "../../utils/stringUtils.js";

interface TokenTransactions {
    transactionList : TransactionList[]
    performanceETH : number;
    performanceUSD : number;
}
config({ path: 'src/../.env' });
export class Account {
    jsonRpcProvider : JsonRpcProvider;
    transactionList : TransactionResponseExtended[] = []; // TransactionList
    address : string;
    lastBlockUpdate : number = 0; 
    balanceInETH: number = 0;
    balanceInUSD: number = 0;
    balanceHistory : BalanceHistory;
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

        const historyFilePath : string = path.join( this.__dirname ,"../../../data/histories/", `${this.address}History.json`);

        if (fs.existsSync(historyFilePath)) {
            this.balanceHistory = JSON.parse(fs.readFileSync(historyFilePath, 'utf8'));
        }
        else {
            fs.promises.writeFile(historyFilePath, JSON.stringify({}));
            this.balanceHistory = {};
        }
    }

    getAccountBalance() {

    }

    async processTransaction(tx: TransactionResponseExtended) {
        return await this.getTransactionTransferlogs(tx);
    }

    async updateBalances({ transferTxSummary } : { transferTxSummary: TransferTx[] }) {
        let tokenSymbol : string = "";
        let tokenAddress : string = "";
        let tokenPath : "IN" | "OUT" | undefined;
        for (let transferTx of transferTxSummary){
            // NOTE: FOR NOW WE REMOVE INNER TRANSFERS THAT HAVE NO INTERACTION WITH ACCOUNT
            if( transferTx?.status && !containsUsdOrEth(transferTx.symbol)) {
                tokenAddress = transferTx.tokenAdress;
                tokenSymbol = transferTx.symbol;
                tokenPath = transferTx.status;
                if (tokenAddress in this.balanceHistory) {
                    //current = ;
                    
                    this.balanceHistory[tokenAddress].numberOfTx += 1; 
                }
                else {
                    this.balanceHistory[tokenAddress] = {    
                        tokenSymbol : tokenSymbol,
                        EthGained : 0,
                        EThSpent : 0,
                        pairSpent : 0,
                        pairGained : 0,
                        numberOfTx : 1,
                        lastTxBlock : transferTx.blockNumber
                    }
                }
                if(tokenAddress == '0xEa83377C306d0De6ED5A5d5ac45cefCe9890cF8f'){
                    console.log(transferTxSummary);
                }
                let index = transferTxSummary.indexOf(transferTx);
                if (index > -1) {
                    transferTxSummary.splice(index, 1);
                }
                break;
            }
        }
        let pairDiffETH : boolean = false;
        for (let transferTx of transferTxSummary){
            if (transferTx?.status) {
                let pairType: "ETH" | "USD" = OneContainsStrings(transferTx.symbol, ["usd"]) ? "USD" : 
                              OneContainsStrings(transferTx.symbol, ["eth"]) ? "ETH" : null;
        
                if (pairType) {
                    pairDiffETH = true;
                    this.balanceHistory[tokenAddress].pair = pairType;
                    let amount = Number(transferTx.amount);
                    if (transferTx.status === "IN") {
                        this.balanceHistory[tokenAddress].pairGained += amount;
                    } else if (transferTx.status === "OUT") {
                        this.balanceHistory[tokenAddress].pairSpent += amount;
                    }
                }
            }
        }
        if(!pairDiffETH){
            for (let transferTx of transferTxSummary){
                if (!transferTx?.status && tokenAddress !== transferTx.tokenAdress) {// WE HAVE TO MAKE SURE IT'S WETH SO WE ARE GOING TO DO AND =/= from token 
                    // BUT IT CAN BE WHATEVER SO, WE HAVE TO DO, == WETH adrr (in db). 
                    this.balanceHistory[tokenAddress].pair = 'ETH';
                    let amount = Number(transferTx.amount);
                    if (tokenPath === "IN") {
                        this.balanceHistory[tokenAddress].EThSpent += amount;
                    } else if (tokenPath === "OUT") {
                        this.balanceHistory[tokenAddress].EthGained += amount;
                    }
                }
            }
        }
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
                const logs = await this.getTransactionTransferlogs(transaction);
                const result = { hash: transaction.hash, logs: logs };
                results.push(result);
            } catch (error) {
                console.error(`Error processing transaction ${transaction.hash}:`, error);
                results.push({ hash: transaction.hash, error: error.message });
            }
        }

        try {
            fs.promises.writeFile('transactionsResults.json', JSON.stringify(this.balanceHistory, null, 2));
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

    async getTransactionTransferlogs(tx: TransactionResponseExtended): Promise<TransferTx[]> {

        // console.log("Processing transaction hash:", tx.hash); // Log the transaction hash
        const interfaceERC20 = new Interface(erc20);
    
        try {
            // Get transaction receipt
            const transactionReceipt = await this.jsonRpcProvider.getTransactionReceipt(tx.hash);
            
            //Loop through Log :
            let transferTxSummary : TransferTx[] = [];
    
            for (let log of transactionReceipt.logs) {
                let logCopy = {
                    ...log,
                    topics: [...log.topics]
                };
                let contractERC20: Contract;
                try {
                    contractERC20 = new ethers.Contract(log.address, erc20, this.jsonRpcProvider);
                }
                catch(err) {
                    console.log(err);
                }
    
                const parsedLog : LogDescription = interfaceERC20.parseLog(logCopy);
                let tokenDecimals : bigint;
                try {
                    tokenDecimals = await contractERC20.decimals()
                }
                catch(err) {
                    tokenDecimals = 18n; 
                }
                if (parsedLog?.name && (parsedLog.name === "Transfer" )) { 
                    let transferTx : TransferTx = {
                        blockNumber : tx.blockNumber,
                        timestamp : parseInt(tx?.timeStamp),
                        tokenAdress : log.address,
                        amount : BigIntDivisionForAmount(parsedLog.args[2] as bigint, 10n**tokenDecimals),
                        symbol  : (contractERC20.symbol) ? await contractERC20.symbol() as string : undefined,
                        status : determineTransactionType(this.address, parsedLog)
                    }
    
                    transferTxSummary.push(transferTx);

                    
                } 
                else {
                    // console.log("Non-transfer log:", log);
                }
            }
            // console.log("Transaction hash:", tx.hash, '\n------------------');
            // console.log("Transfer logs:", transferTxLogs);
            await this.updateBalances({ transferTxSummary: [...transferTxSummary] });
            return transferTxSummary;
        }
        catch (e) {
            console.error("Error processing transaction:", tx.hash, e);
            return [];
        }
    }
}