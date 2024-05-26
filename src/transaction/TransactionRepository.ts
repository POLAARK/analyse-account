import { injectable } from "inversify";
import { MoreThan } from "typeorm";
import { TypeOrmRepository } from "../genericRepository/TypeOrmRepository";
import { ITransactionRepository } from "./ITransactionRepository";
import { Transaction } from "./Transaction";

@injectable()
export class TransactionRepository
  extends TypeOrmRepository<Transaction>
  implements ITransactionRepository
{
  constructor() {
    super(Transaction);
  }
  async findTransactionsByTimestamp(
    walletAddress: string,
    timestamp: number
  ): Promise<Transaction[]> {
    const transactions = await this.repository.find({
      where: { wallet: { address: walletAddress }, timeStamp: MoreThan(timestamp) },
      order: { timeStamp: "DESC" },
    });
    return transactions;
  }
}
