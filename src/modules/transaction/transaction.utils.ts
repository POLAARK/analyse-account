import { Contract, Interface, LogDescription, Provider, TransactionResponse } from "ethers";
import { erc20 } from "../abis/erc20";

export function getETHtoUSD(valueInETH: string) {
    console.log("TO BE IMPLEMENTED : getETHtoUSD")
    return valueInETH;
}

export function determineTransactionType(provider : Provider, accountAddress: string, tx: TransactionResponse, decodedInput: any): 'buy' | 'sell' | 'unknown' {
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

export async function getTransactionTransferlogs(provider : Provider,  tx : TransactionResponse) : Promise<LogDescription[]>{
    const interfaceERC20 = new Interface(erc20);
    const transactionReceipt = await provider.getTransactionReceipt(tx.hash); 
    const parsedTxLogs = transactionReceipt.logs.map((log) => 
    {
        const logCopy = {
            ...log,
            topics: [...log.topics]
        };
        return interfaceERC20.parseLog(logCopy);
    })
    const transferTxLogs = parsedTxLogs.filter(log => log.name === "Transfer");
    return transferTxLogs; 
}