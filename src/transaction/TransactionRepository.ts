import { inject, injectable } from "inversify";
import { DataSource, MoreThan } from "typeorm";
import { TypeOrmRepository } from "../genericRepository/TypeOrmRepository";
import SERVICE_IDENTIFIER from "../ioc_container/identifiers";
import { ITransactionRepository } from "./ITransactionRepository";
import { Transaction } from "./Transaction";

@injectable()
export class TransactionRepository
  extends TypeOrmRepository<Transaction>
  implements ITransactionRepository
{
  constructor(@inject(SERVICE_IDENTIFIER.DataSource) dataSource: DataSource) {
    super(Transaction, dataSource);
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
