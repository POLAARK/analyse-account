import { Contract, Interface, LogDescription, Provider, TransactionResponse, ethers } from "ethers";
import { erc20 } from "../abis/erc20.js";
import { TransferTx } from "./transaction.entity.js";

export function getETHtoUSD(valueInETH: string) {
    console.log("TO BE IMPLEMENTED : getETHtoUSD")
    return valueInETH;
}

export function determineTransactionType(accountAddress: string, parsedLog : LogDescription ): "IN" | "OUT" {

    if (parsedLog.args[0] == accountAddress){
        return "OUT";
    }
    if (parsedLog.args[1] == accountAddress){
        return "IN";
    }
    return;
}

export async function getTransactionTransferlogs(provider: Provider, tx: TransactionResponse, address : string): Promise<TransferTx[]> {

    // console.log("Processing transaction hash:", tx.hash); // Log the transaction hash
    const interfaceERC20 = new Interface(erc20);

    try {
        // Get transaction receipt
        const transactionReceipt = await provider.getTransactionReceipt(tx.hash);
        
        //Loop through Log :
        let transferTxSummary : TransferTx[] = [];
        let transferTxLogs: LogDescription[] = []; // Initialize the array

        for (let log of transactionReceipt.logs) {
            let logCopy = {
                ...log,
                topics: [...log.topics]
            };
            let contractERC20: Contract;
            try {
                contractERC20 = new ethers.Contract(log.address, erc20, provider);
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
            if (parsedLog?.name && (parsedLog.name === "Transfer" )) { // || parsedLog.name === "Permit"
                let transferTx : TransferTx = {
                    tokenAdress : log.address,
                    amount : BigIntDivisionForAmount(parsedLog.args[2] as bigint, 10n**tokenDecimals),
                    symbol  : (contractERC20.symbol) ? await contractERC20.symbol() as string : undefined,
                    status : determineTransactionType(address, parsedLog)
                }

                transferTxSummary.push(transferTx);
            } 
            else {
                // console.log("Non-transfer log:", log);
            }
        }
        // console.log("Transaction hash:", tx.hash, '\n------------------');
        // console.log("Transfer logs:", transferTxLogs);
        return transferTxSummary;
    }
    catch (e) {
        console.error("Error processing transaction:", tx.hash, e);
        return [];
    }
}

function BigIntDivisionForAmount(amount : bigint, decimals : bigint){
    if (amount / decimals <= 1000000n){
        return parseFloat((Number(amount/10n**6n) / Number(decimals/(10n**6n))).toFixed(3));
    }
    else return amount / decimals
}