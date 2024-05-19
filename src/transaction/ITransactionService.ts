import { LogDescription, TransactionReceipt } from "ethers";
import { Transaction } from "./Transaction";
import { TransferTransaction } from "./transaction.entity";

export interface ITransactionService {
  determineTransactionType(accountAddress: string, parsedLog: LogDescription): "IN" | "OUT";
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
}
