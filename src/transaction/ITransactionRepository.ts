import { IGenericRepository } from "genericRepository/IGenericRepository";
import { Transaction } from "./Transaction";

export interface ITransactionRepository extends IGenericRepository<Transaction> {}
