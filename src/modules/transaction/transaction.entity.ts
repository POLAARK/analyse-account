import { LogDescription, TransactionResponse } from "ethers";

export interface TransactionList {
  transactions: Transaction[];
}

interface Transaction {
  date: string;
  from: string;
  to: string;
  value: string;
  tokenName?: string;
  tokenAdress?: string;
  contractAdress?: string;
}

export interface TransferTx {
  blockNumber: number;
  timestamp: number;
  tokenAdress: string;
  amount: BigInt | number;
  from: string;
  to: string;
  symbol: string;
  status?: "IN" | "OUT";
}

export interface TransactionResponseExtended extends TransactionResponse {
  timeStamp: string;
}
