import { Contract, Interface, LogDescription, Provider, TransactionResponse } from "ethers";
import { erc20 } from "../abis/erc20.js";

export function getETHtoUSD(valueInETH: string) {
    console.log("TO BE IMPLEMENTED : getETHtoUSD")
    return valueInETH;
}

export function determineTransactionType(provider: Provider, accountAddress: string, tx: TransactionResponse, decodedInput: any): 'buy' | 'sell' | 'unknown' {
    // Assuming decodedInput has fields like 'from', 'to', and 'value'
    // and tx represents an ERC-20 token transfer

    // If the account is the recipient in the transaction, it's likely a 'buy'
    if (decodedInput.to && decodedInput.to.toLowerCase() === accountAddress.toLowerCase()) {
        return 'buy';
    }
    // If the account is the sender in the transaction, it's likely a 'sell'
    else if (tx.from && tx.from.toLowerCase() === accountAddress.toLowerCase()) {
        return 'sell';
    }

    // If it's neither, or if the transaction structure is not recognized
    return 'unknown';
}

export async function getTransactionTransferlogs(provider: Provider, tx: TransactionResponse): Promise<LogDescription[]> {

    // console.log("Processing transaction hash:", tx.hash); // Log the transaction hash
    const interfaceERC20 = new Interface(erc20);

    try {
        // Get transaction receipt
        const transactionReceipt = await provider.getTransactionReceipt(tx.hash);

        //Loop through Log :
        for (let log of transactionReceipt.logs) {
            let logCopy = {
                ...log,
                topics: [...log.topics]
            };
            parsedLog = interfaceERC20.parseLog(logCopy);
        }
        const parsedTxLogs = transactionReceipt.logs.map((log) => {
            const logCopy = {
                ...log,
                topics: [...log.topics]
            };
            return interfaceERC20.parseLog(logCopy);
        });

        let transferTxLogs: LogDescription[] = []; // Initialize the array
        for (let log of parsedTxLogs) {
            if (log?.name && (log.name === "Transfer" || log.name === "Permit")) {
                transferTxLogs.push(log);
            }
            else {
                // console.log("Non-transfer log:", log);
            }
        }

        // console.log("Transaction hash:", tx.hash, '\n------------------');
        // console.log("Transfer logs:", transferTxLogs);
        return transferTxLogs;
    }
    catch (e) {
        console.error("Error processing transaction:", tx.hash, e);
        return [];
    }
}

// If the transfer goes through a router, we use the pair, we can get token0 base and token1 = token traded. 
// If we sent from  token1 = sell if we receive