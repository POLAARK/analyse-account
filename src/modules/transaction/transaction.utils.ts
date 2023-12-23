import { Contract, Interface, LogDescription, Provider, TransactionResponse, ethers } from "ethers";
import { erc20 } from "../abis/erc20.js";
import { TransactionResponseExtended, TransferTx } from "./transaction.entity.js";

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


export function BigIntDivisionForAmount(amount : bigint, decimals : bigint){
    if (amount / decimals <= 1000000n){
        return parseFloat((Number(amount/10n**6n) / Number(decimals/(10n**6n))).toFixed(3));
    }
    else return amount / decimals
}

