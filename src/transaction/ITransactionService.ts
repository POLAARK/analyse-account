import { LogDescription, TransactionReceipt } from "ethers";
import { Transaction } from "./Transaction";
import { type TransferTransaction } from "./transaction.entity";
import { TokenHistory } from "../tokenHistory";

export interface ITransactionService {
  determineTransactionType(
    accountAddress: string,
    parsedLog: LogDescription
  ): "IN" | "OUT" | undefined;
  addTransferTransactionIfValue(
    transaction: Transaction,
    transferTransactionSummary: TransferTransaction[],
    transactionReceipt: TransactionReceipt
  ): void;
  getTransactionTransferSummaryFromLog(
    transaction: Transaction,
    address: string
  ): Promise<TransferTransaction[]>;
  aggregateTransferTransactions(
    transferTransactionSummary: TransferTransaction[]
  ): TransferTransaction[];
  findMainTokenTradedOnTransaction(
    transferTxSummary: TransferTransaction[],
    walletAddress: string
  ): Promise<{
    updatedTransferTransactionSummary: TransferTransaction[];
    tokenHistory: TokenHistory;
    tokenPath: "IN" | "OUT" | undefined;
  }>;
  getTransactionByTimestamp(address: string, timestamp: number): Promise<Transaction[]>;
}
