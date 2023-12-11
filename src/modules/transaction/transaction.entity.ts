import { TransactionResponse } from "ethers"

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
