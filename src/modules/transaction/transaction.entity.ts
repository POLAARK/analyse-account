import { TransactionResponse } from "ethers"

interface TransactionList {
    transactions : Transaction[]
}

interface Transaction {
    date : string
    from : string
    to : string
    value : string
    tokenName? : string 
    tokenAdress? : string
    contractAdress? : string
}

export function determineTransactionType(accountAddress: string, tx: TransactionResponse, decodedInput: any): 'buy' | 'sell' | 'unknown' {
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