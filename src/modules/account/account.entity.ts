// type Account = {
//     address : string,
//     lastBlock : number
// }
export interface TokenHistory {
    tokenSymbol : string,
    pairSpent : number,
    pairGained : number,
    EThSpent : number, 
    EthGained : number, 
    pair? : "ETH" | "USD" | null,
    numberOfTx : number,
    lastTxBlock : number
}

export type BalanceHistory = {[address : string] : TokenHistory};