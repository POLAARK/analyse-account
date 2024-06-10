import { type IGenericRepository } from "../genericRepository/IGenericRepository";
import { Transaction } from "./Transaction";

export interface ITransactionRepository extends IGenericRepository<Transaction> {
  findTransactionsByTimestamp(walletAddress: string, timestamp: number): Promise<Transaction[]>;
}
