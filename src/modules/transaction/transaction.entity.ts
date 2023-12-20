import { LogDescription, TransactionResponse } from "ethers"

export interface TransactionList {
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

export interface TransferTx {
    tokenAdress : string
    amount : number | BigInt
    symbol : string
    status? : "IN" | "OUT"
}

export interface LogDescriptionExtended extends LogDescription {

}