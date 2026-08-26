import { TransactionResponse } from "ethers";

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

export interface TransferTransaction {
  blockNumber: number;
  timestamp: number;
  tokenAdress: string;
  amount: number;
  from: string;
  to: string;
  symbol: string;
  status?: "IN" | "OUT";
  /** Raw amount in smallest token units (wei-scale integer) as a decimal string. */
  amountRaw?: string;
  /** Token decimals used to interpret amountRaw. */
  tokenDecimals?: number;
}

export interface TransactionResponseExtended extends TransactionResponse {
  timeStamp: string;
}
